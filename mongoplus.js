const mongoose = require('mongoose');

const { performance } = require('perf_hooks');

class Mongoplus {
    constructor(mongoURI) {
        this.mongoURI = mongoURI;
        this.allConnections = [];
        this.currentIndex = 0;
        if (this.mongoURI.filter((uri) => uri.startsWith("readonly")).length == this.mongoURI.length) {
            throw new Error('Some of your URIs must be writable. If it is a mistake remove the `readonly:` flag from your urls')
        }
    }

    static readonlydbs = []
    static readonlymodels = []

    Schema(schema) {
        return mongoose.Schema(schema)
    }

    addIndex(schema, indextype) {
        // MongoDB 4.2+ no longer supports 'background' option, removing it if present
        const cleanIndexType = { ...indextype };
        delete cleanIndexType.background;
        return schema.index(cleanIndexType)
    }

    getNextMongoURI() {
        const uri = this.mongoURI[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.mongoURI.length;
        return uri;
    }

    connectToAll(connectionOptions = {}) {
        for (let i = 0; i < this.mongoURI.length; i++) {
            const uri = this.mongoURI[i].replaceAll("readonly:", '');




            const con = mongoose.createConnection(uri, connectionOptions);

            this.allConnections.push(con);
            if (this.mongoURI[i].startsWith('readonly:')) {
                Mongoplus.readonlydbs.push(con)
            }
        }

        return this.allConnections;
    }

    buildModel(name, schema) {
        if (!Object.keys(schema.obj).includes("dbIndex")) {
            throw new Error(`[!]Error :  < dbIndex > must be present in your schema like dbIndex:{
            type: Number,
            required: true
          } `)
        }
        if (this.allConnections.length <= 0) {
            throw new Error(`[!]Error :  All connections should be made first use the code 
            (async () => {await mongodb.connectToAll();})(); to init connections here mongodb is the class init variable`)
        }
        const allConnections = this.allConnections;
        const model = [];

        for (let i = 0; i < allConnections.length; i++) {
            const mongooseConnection = allConnections[i];
            var currentm = mongooseConnection.model(name, schema)
            model.push(currentm);

            if (Mongoplus.readonlydbs.includes(allConnections[i])) {
                Mongoplus.readonlymodels.push(currentm)
            }
        }
        console.log("REadonly ", Mongoplus.readonlymodels)
        return new MongoModel(model, schema, Mongoplus.readonlymodels);
    }
}

class MongoModel {
    constructor(model, s, readonlydbs) {
        if (!Array.isArray(model)) {
            throw new Error('Model should be an array');
        }
        this.model = model;
        this.readonlydbs = readonlydbs
        this.s = s
    }

    static currentIndex = 0

    async findInAllDatabase(filter, chain = {}) {
        const dynamicComputationPromises = [];
        this.model.forEach((modelRef) => {
            dynamicComputationPromises.push({ fn: modelRef.find.bind(modelRef), params: [filter], chain: chain });
        });
        return await this.runLargeComputations(dynamicComputationPromises);
    }

    async aggregateInAllDatabase(filter, chain = {}) {
        const dynamicComputationPromises = [];
        this.model.forEach((modelRef) => {
            dynamicComputationPromises.push({ fn: modelRef.aggregate.bind(modelRef), params: [filter], chain: chain });
        });
        return await this.runLargeComputations(dynamicComputationPromises);
    }

    async writeInAllDatabase(data) {
        data["dbIndex"] = -1
        const promises = [];
        for (let i = 0; i < this.model.length; i++) {
            if (Mongoplus.readonlymodels.includes(this.model[i])) continue;
            const docData = Object.assign({}, data, { dbIndex: i });
            const x = new this.model[i](docData);
            promises.push(x.save());
        }

        return Promise.all(promises);
    }

    async UpdateOneInAllDatabase(filter, update) {
        const dynamicComputationPromises = [];
        this.model.forEach((modelRef) => {
            dynamicComputationPromises.push({ fn: modelRef.findOneAndUpdate.bind(modelRef), params: [filter, update, { new: true }], chain: {} });
        });
        return await this.runLargeComputations(dynamicComputationPromises);
    }

    async UpdateByIdInAllDatabase(id, update) {
        const dynamicComputationPromises = [];
        this.model.forEach((modelRef) => {
            dynamicComputationPromises.push({ fn: modelRef.findByIdAndUpdate.bind(modelRef), params: [id, update, { new: true }], chain: {} });
        });
        return await this.runLargeComputations(dynamicComputationPromises);
    }

    async findByIdInAllDatabaseAndDelete(id) {
        const dynamicComputationPromises = [];
        this.model.forEach((modelRef) => {
            // Changed from findByIdAndRemove to findByIdAndDelete (Mongoose 8 removed findByIdAndRemove)
            dynamicComputationPromises.push({ fn: modelRef.findByIdAndDelete.bind(modelRef), params: [id], chain: {} });
        });
        return await this.runLargeComputations(dynamicComputationPromises);
    }

    async findOneInAllDatabaseAndDelete(filter) {
        const dynamicComputationPromises = [];
        this.model.forEach((modelRef) => {
            dynamicComputationPromises.push({ fn: modelRef.findOneAndDelete.bind(modelRef), params: [filter], chain: {} });
        });
        return await this.runLargeComputations(dynamicComputationPromises);
    }

    /**
     * Delete many documents matching `filter` in all databases and return aggregated results.
     */
    async findManyInAllDatabaseAndDelete(filter) {
        const dynamicComputationPromises = [];
        this.model.forEach((modelRef) => {
            dynamicComputationPromises.push({ fn: modelRef.deleteMany.bind(modelRef), params: [filter], chain: {} });
        });
        return await this.runLargeComputations(dynamicComputationPromises);
    }

    async write(data) {
        const currentModel = this.model[MongoModel.currentIndex];
        data["dbIndex"] = MongoModel.currentIndex;
        MongoModel.currentIndex = (MongoModel.currentIndex + 1) % this.model.length;

        if (Mongoplus.readonlymodels.includes(currentModel)) {
            return await this.write(data);
        }

        try {
            let dataToWrite = new currentModel(data)
            return await dataToWrite.save()
        } catch (error) {
            throw error
        }
    }

    async bulkWrite(data, options = {}) {
        // Default options
        const {
            batchSize = 1000,
            concurrentBatches = true
        } = options;

        if (!data || data.length === 0) return [];

        // 1. Identify writable models
        const writableModels = this.model.filter(m => !Mongoplus.readonlymodels.includes(m));
        const numDBs = writableModels.length;

        if (numDBs === 0) {
            throw new Error("No writable databases available.");
        }

        // Split data into batches
        const batches = [];
        for (let i = 0; i < data.length; i += batchSize) {
            batches.push(data.slice(i, i + batchSize));
        }

        console.log(`[Mongoplus] Processing ${data.length} items in ${batches.length} batch(es) of max ${batchSize} items`);

        const finalRetryArray = [];
        const allResults = [];

        // Process function for a single batch
        const processBatch = async (batchData, batchNumber) => {
            // 2. Internal Bucket Distribution & Op Transformation
            const buckets = Array.from({ length: numDBs }, () => []);

            batchData.forEach((item, index) => {
                const bucketIndex = index % numDBs;
                const writableModel = writableModels[bucketIndex];

                // Find the actual dbIndex in the full model array
                const dbIdx = this.model.indexOf(writableModel);

                // Clone to avoid mutating original data
                const itemCopy = { ...item, dbIndex: dbIdx };

                // Build filter for updateOne - require _id or explicit id field
                let filter;
                if (itemCopy._id) {
                    filter = { _id: itemCopy._id };
                } else if (itemCopy.id) {
                    filter = { _id: itemCopy.id };
                    itemCopy._id = itemCopy.id;
                } else {
                    // Mongoose 9: use 'new' keyword with ObjectId (required since Mongoose 7)
                    itemCopy._id = new mongoose.Types.ObjectId();
                    filter = { _id: itemCopy._id };
                }

                buckets[bucketIndex].push({
                    updateOne: {
                        filter: filter,
                        update: { $set: itemCopy },
                        upsert: true
                    }
                });
            });

            // 3. Transaction Runner with Retry Logic
            const runTransactionWithRetry = async (model, ops, modelIndex) => {
                let session;
                try {
                    session = await model.db.startSession();
                } catch (sessionError) {
                    throw new Error(`[Mongoplus] Database ${modelIndex} is a standalone instance. Transactions (required for bulkWriteZipper) only work on Replica Sets. \nError: ${JSON.stringify(sessionError)}`);
                }

                const attemptWrite = async () => {
                    let result;
                    await session.withTransaction(async () => {
                        result = await model.bulkWrite(ops, { session, ordered: false });
                    });
                    return result;
                };

                try {
                    // First Attempt
                    return await attemptWrite();
                } catch (firstError) {
                    console.warn(`[Mongoplus] Batch ${batchNumber} failed for ${model.modelName} (DB ${modelIndex}). Retrying once...`);
                    try {
                        // Second Attempt (Retry)
                        return await attemptWrite();
                    } catch (retryError) {
                        // Fail: Store in retry array for the final error report
                        finalRetryArray.push({
                            batch: batchNumber,
                            model: model.modelName,
                            dbIndex: modelIndex,
                            opsCount: ops.length,
                            data: ops.map(o => o.updateOne.update.$set),
                            error: retryError.message
                        });
                        throw retryError;
                    }
                } finally {
                    await session.endSession();
                }
            };

            // 4. Execute all "Zips" concurrently for this batch
            const results = await Promise.all(
                buckets.map((ops, i) => {
                    if (ops.length === 0) return Promise.resolve(null);
                    const dbIdx = this.model.indexOf(writableModels[i]);
                    return runTransactionWithRetry(writableModels[i], ops, dbIdx);
                })
            );

            return results.filter(r => r !== null);
        };

        // Process all batches
        try {
            if (concurrentBatches && batches.length > 1) {
                console.log(`[Mongoplus] Running ${batches.length} batches concurrently`);
                const batchResults = await Promise.all(
                    batches.map((batch, idx) => processBatch(batch, idx + 1))
                );
                allResults.push(...batchResults.flat());
            } else {
                console.log(`[Mongoplus] Running ${batches.length} batches sequentially`);
                for (let i = 0; i < batches.length; i++) {
                    const result = await processBatch(batches[i], i + 1);
                    allResults.push(...result);
                    console.log(`[Mongoplus] Completed batch ${i + 1}/${batches.length}`);
                }
            }

            // Update global rotation index for write() method consistency
            MongoModel.currentIndex = (MongoModel.currentIndex + data.length) % this.model.length;

            console.log(`[Mongoplus] Successfully processed ${data.length} items across ${numDBs} databases`);
            return allResults;

        } catch (error) {
            // Throw a comprehensive error containing the retry array
            const exception = new Error(`Zipper Bulk Write failed after retries: ${error.message}`);
            exception.failedBatches = finalRetryArray;
            exception.originalError = error;
            throw exception;
        }
    }

    async findOne(dbIndex, filter, chain = {}) {
        var currentModel = this.model[dbIndex]

        if (chain.skip && chain.limit && chain.sort) {
            return currentModel.findOne(filter).skip(chain.skip).limit(chain.limit).sort(chain.sort)
        } else if (chain.skip && chain.limit) {
            return currentModel.findOne(filter).skip(chain.skip).limit(chain.limit)
        }
        else if (chain.skip) {
            return currentModel.findOne(filter).skip(chain.skip)
        }
        else if (chain.limit) {
            return currentModel.findOne(filter).limit(chain.limit)
        } else {
            return currentModel.findOne(filter);
        }
    }

    async find(dbIndex, filter, chain = {}) {
        var currentModel = this.model[dbIndex]
        // Start with the base query
        let query = currentModel.find(filter);

        // Dynamically apply chain options if they exist
        for (const [key, value] of Object.entries(chain)) {
            if (query[key]) {
                query = query[key](value);
            }
        }

        return query;
    }

    async findById(dbIndex, filter, chain = {}) {
        const currentModel = this.model[dbIndex];

        // Start with the base query
        let query = currentModel.findById(filter);

        // Dynamically apply chain options if they exist
        for (const [key, value] of Object.entries(chain)) {
            if (query[key]) {
                query = query[key](value);
            }
        }

        return query;
    }

    async findByIdAndUpdate(dbIndex, id, update) {
        var currentModel = this.model[dbIndex]
        return currentModel.findByIdAndUpdate(id, update, { new: true });
    }

    async findByIdAndDelete(dbIndex, id) {
        var currentModel = this.model[dbIndex]
        // Changed from findByIdAndRemove to findByIdAndDelete (Mongoose 8 removed findByIdAndRemove)
        return currentModel.findByIdAndDelete(id, { new: true });
    }

    async findOneAndUpdate(dbIndex, filter, update) {
        var currentModel = this.model[dbIndex]
        return currentModel.findOneAndUpdate(filter, update, { new: true });
    }

    async aggregate(dbIndex, filter, update) {
        var currentModel = this.model[dbIndex]
        return currentModel.aggregate(filter);
    }

    async watch(dbIndex) {
        return this.model[dbIndex].watch()
    }

    getNextModel() {
        const currentModel = this.model[this.currentIndex];
        var writen = this.currentIndex
        this.currentIndex = (this.currentIndex + 1) % this.model.length;
        return [currentModel, writen];
    }

    async runLargeComputations(computationPairs) {
        try {
            const startTime = performance.now();

            // Execute all computation functions concurrently using Promise.all
            const results = await Promise.all(
                computationPairs.map(async pair => {
                    var chain = pair.chain;
                    var query = pair.fn(...pair.params);

                    // Dynamically apply chain options if they exist
                    for (const [key, value] of Object.entries(chain)) {
                        if (query[key]) {
                            query = query[key](value);
                        }
                    }

                    return query;
                })
            );

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            return { results: [].concat(...results), totalTime };
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
}

// Attach named export and default for interoperability
Mongoplus.MongoModel = MongoModel;
module.exports = Mongoplus;
module.exports.default = Mongoplus;
module.exports.MongoModel = MongoModel;
exports.MongoModel = MongoModel;