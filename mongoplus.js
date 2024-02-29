const mongoose = require('mongoose');
class Mongoplus {
    constructor(mongoURI) {

        this.mongoURI = mongoURI;
        this.allConnections = [];
        this.currentIndex = 0;
        if(this.mongoURI.filter((uri)=>uri.startsWith("readonly")).length==this.mongoURI.length){
            throw new Error('Some of your URIs must be writable. If it is a mistake remove the `readonly:` flag from your urls')
        }
        
    }
    static readonlydbs=[]
    static readonlymodels=[] // Define currentIndex to keep track of the current URI
    Schema(schema) {
        return mongoose.Schema(schema)
    }
    addIndex(schema,indextype){
return schema.index(indextype)
    }
    getNextMongoURI() {
        const uri = this.mongoURI[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.mongoURI.length;
        return uri;
    }

    connectToAll() {
        for (let i = 0; i < this.mongoURI.length; i++) {
          
            const uri = this.mongoURI[i].replaceAll("readonly:",'');
            const con = mongoose.createConnection(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            this.allConnections.push(con);
            if(this.mongoURI[i].startsWith('readonly:')){
              
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
        if(this.allConnections.length<=0){
            throw new Error(`[!]Error :  All connections should be made first use the code 
            (async () => {await mongodb.connectToAll();})(); to init connections here mongodb is the class init variable`)
        }
        const allConnections = this.allConnections;
        const model = [];
        //console.groupCollapsed("====>",Mongoplus.readonlydbs);
        for (let i = 0; i < allConnections.length; i++) {
            const mongooseConnection = allConnections[i];
            var currentm=mongooseConnection.model(name, schema)
            model.push(currentm);
            //console.count(Mongoplus.readonlydbs[i]);
            if(Mongoplus.readonlydbs.includes(allConnections[i])){
                
                Mongoplus.readonlymodels.push(currentm)
            }
        }
        console.log("REadonly ",Mongoplus.readonlymodels)
        return new MongoModel(model,schema,Mongoplus.readonlymodels);
    }
}

class MongoModel {
    constructor(model,s,readonlydbs) {
        if (!Array.isArray(model)) {
            throw new Error('Model should be an array');
        }
        this.model = model;
        this.readonlydbs=readonlydbs
        this.s=s
     

    }
    static currentIndex = 0
    //===================

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
    //==================
    async writeInAllDatabase(data) {
        data["dbIndex"] = -1
        const dynamicComputationPromises = [];
        modellist=this.model
        //this.readonlydbs.forEach((i)=>{modellist.splice(i,1,null)})
        
        for (let i = 0; i < this.model.length; i++) {
          if(Mongoplus.readonlymodels.includes(this.model[i])) continue;
                var x=new this.model[i](data)
                
                dynamicComputationPromises.push(await x.save());
         
            
        }
      
        return [].concat(dynamicComputationPromises);

    }
    //==================
    async UpdateOneInAllDatabase(filter, update) {
       
        const dynamicComputationPromises = [];
        this.model.forEach((modelRef) => {

            dynamicComputationPromises.push({ fn: modelRef.findOneAndUpdate.bind(modelRef), params: [filter, update, { new: true }], chain: {} });
        });
        return await this.runLargeComputations(dynamicComputationPromises);

    }
    //==================
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
    //=======================
    async write(data) {
       
   
            const currentModel = this.model[MongoModel.currentIndex];
            data["dbIndex"] = MongoModel.currentIndex;
            MongoModel.currentIndex = (MongoModel.currentIndex + 1) % this.model.length;
    if(Mongoplus.readonlymodels.includes(currentModel)){
        this.write(data)
        //("This model is readonly");
      
    }
   
     
        try {

            let dataToWrite = new currentModel(data)
            return await dataToWrite.save()
        } catch (error) {
            throw error
        }

    }
    //==================

    async findOne(dbIndex, filter, chain = {}) {
        var currentModel = this.model[dbIndex]
       
        if (chain.skip && chain.limit && chain.sort) {
            currentModel.findOne(filter).skip(chain.skip).limit(chain.limit).sort(chain.sort)
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

    //===============

    async find(dbIndex, filter, chain = {}) {
        var currentModel = this.model[dbIndex]
       
        if (chain.skip && chain.limit && chain.sort) {
            currentModel.find(filter).skip(chain.skip).limit(chain.limit).sort(chain.sort)
        } else if (chain.skip && chain.limit) {
            return currentModel.find(filter).skip(chain.skip).limit(chain.limit)
        }
        else if (chain.skip) {
            return currentModel.find(filter).skip(chain.skip)
        }

        else if (chain.limit) {
            return currentModel.find(filter).limit(chain.limit)
        } else {
            return currentModel.find(filter);
        }


    }
    //=======================
    async findById(dbIndex, filter, chain = {}) {
        var currentModel = this.model[dbIndex]
       
        if (chain.skip && chain.limit && chain.sort) {
            currentModel.findById(filter).skip(chain.skip).limit(chain.limit).sort(chain.sort)
        } else if (chain.skip && chain.limit) {
            return currentModel.findById(filter).skip(chain.skip).limit(chain.limit)
        }
        else if (chain.skip) {
            return currentModel.findById(filter).skip(chain.skip)
        }

        else if (chain.limit) {
            return currentModel.findById(filter).limit(chain.limit)
        } else {
            return currentModel.findById(filter);
        }


    }

    //==========================
    async findById(dbIndex, filter, chain = {}) {
        var currentModel = this.model[dbIndex]
        
        if (chain.skip && chain.limit && chain.sort) {
            currentModel.findById(filter).skip(chain.skip).limit(chain.limit).sort(chain.sort)
        } else if (chain.skip && chain.limit) {
            return currentModel.findById(filter).skip(chain.skip).limit(chain.limit)
        }
        else if (chain.skip) {
            return currentModel.findById(filter).skip(chain.skip)
        }

        else if (chain.limit) {
            return currentModel.findById(filter).limit(chain.limit)
        } else {
            return currentModel.findById(filter);
        }


    }
    //====================
    async findByIdAndUpdate(dbIndex, id, update) {
        var currentModel = this.model[dbIndex]
        return currentModel.findByIdAndUpdate(id, update, { new: true });
    }
    //===============
    async findByIdAndDelete(dbIndex, id, update) {
        var currentModel = this.model[dbIndex]
        return currentModel.findByIdAndRemove(id, update, { new: true });
    }
    //===========
    async findOneAndUpdate(dbIndex, filter, update) {
        var currentModel = this.model[dbIndex]
        return currentModel.findOneAndUpdate(filter, update, { new: true });
    }
    //=============
    async aggregate(dbIndex, filter, update) {
        var currentModel = this.model[dbIndex]
        return currentModel.aggregate(filter);
    }
    //===========
    async watch(dbIndex) {
        return this.model[dbIndex].watch()
    }
//================





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
                    if (chain.skip && chain.limit && chain.sort) {
                        pair.fn(...pair.params).skip(chain.skip).limit(chain.limit).sort(chain.sort)
                    } else if (chain.skip && chain.limit) {
                        return pair.fn(...pair.params).skip(chain.skip).limit(chain.limit)
                    }
                    else if (chain.skip) {
                        return pair.fn(...pair.params).skip(chain.skip)
                    }

                    else if (chain.limit) {
                        return pair.fn(...pair.params).limit(chain.limit)
                    } else {
                        return pair.fn(...pair.params);
                    }
                })




            );

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            // Process the results as needed
            // const sum = results.reduce((acc, result) => acc + result, 0);

            return { results: [].concat(...results), totalTime };
        } catch (error) {
            console.error('Error:', error);
            throw error; // Rethrow the error if needed
        }
    }
}

module.exports = Mongoplus;
