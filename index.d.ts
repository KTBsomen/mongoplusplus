import mongoose = require('mongoose');

/**
 * Mongoplus manages multiple mongoose connections and builds distributed models.
 *
 * Example:
 * ```ts
 * import Mongoplus from 'mongoplusplus';
 * const mp = new Mongoplus(['mongodb://a/db','readonly:mongodb://b/db']);
 * await mp.connectToAll();
 * ```
 */
declare class Mongoplus {
    /** Array of connection URIs. Use `readonly:` prefix to mark read-only URIs. */
    mongoURI: string[];
    /** All mongoose connections created by `connectToAll`. */
    allConnections: mongoose.Connection[];
    /** Internal rotation index. */
    currentIndex: number;
    /** Connections created from `readonly:` URIs. */
    static readonlydbs: mongoose.Connection[];
    /** Models corresponding to readonly connections. */
    static readonlymodels: any[];

    /**
     * Create manager with list of URIs.
     * @example
     * const mp = new Mongoplus(['mongodb://a/db','readonly:mongodb://b/db']);
     */
    constructor(mongoURI: string[]);

    /**
     * Create a mongoose Schema.
     * @example
     * const schema = mp.Schema({ name: String, dbIndex: { type: Number, required: true } });
     */
    Schema(schema: mongoose.SchemaDefinition | mongoose.Schema): mongoose.Schema;

    /**
     * Add an index to a schema.
     * @example
     * mp.addIndex(schema, { email: 1 });
     */
    addIndex(schema: mongoose.Schema, indextype: any): void;

    /**
     * Return next MongoDB URI in rotation.
     */
    getNextMongoURI(): string;

    /**
     * Establish all connections. Call before `buildModel`.
     * @returns array of `mongoose.Connection`.
     */
    connectToAll(): mongoose.Connection[];

    /**
     * Build a distributed model across all connections. Schema must include `dbIndex`.
     * @example
     * const User = mp.buildModel('User', schema);
     */
    buildModel(name: string, schema: mongoose.Schema): MongoModel;
}

/**
 * MongoModel wraps per-connection models and exposes multi-DB helpers.
 */
declare class MongoModel {
    /** Per-connection mongoose Model instances. */
    model: any[];
    /** Read-only model references. */
    readonlydbs: any[];
    /** Original schema. */
    s: mongoose.Schema;
    /** Rotation index for `write`. */
    static currentIndex: number;

    /**
     * Construct a MongoModel.
     * @example
     * const mm = new MongoModel([M1,M2], schema, [M2]);
     */
    constructor(model: any[], s: mongoose.Schema, readonlydbs: any[]);

    /**
     * Run `find` on every DB and return aggregated results with timing.
     * @example
     * const { results, totalTime } = await User.findInAllDatabase({ active: true });
     */
    findInAllDatabase(filter: any, chain?: any): Promise<any>;

    /**
     * Run aggregation pipeline on every DB and return aggregated results.
     * @example
     * await User.aggregateInAllDatabase([{ $match: { age: { $gt: 18 } } }]);
     */
    aggregateInAllDatabase(filter: any, chain?: any): Promise<any>;

    /**
     * Write the same document to all writable DBs. Returns saved docs array.
     * @example
     * await User.writeInAllDatabase({ name: 'Alice' });
     */
    writeInAllDatabase(data: any): Promise<any[]>;

    /**
     * Update one matching document across all DBs.
     * @example
     * await User.UpdateOneInAllDatabase({ active: false }, { active: true });
     */
    UpdateOneInAllDatabase(filter: any, update: any): Promise<any>;

    /**
     * Update by id across all DBs.
     * @example
     * await User.UpdateByIdInAllDatabase(id, { name: 'Bob' });
     */
    UpdateByIdInAllDatabase(id: any, update: any): Promise<any>;

    /**
     * Find by id in all DBs and delete.
     * @example
     * await User.findByIdInAllDatabaseAndDelete(id);
     */
    findByIdInAllDatabaseAndDelete(id: any): Promise<any>;

    /**
     * Find one in all DBs and delete.
     * @example
     * await User.findOneInAllDatabaseAndDelete({ email: 'x@example.com' });
     */
    findOneInAllDatabaseAndDelete(filter: any): Promise<any>;

    /**
     * Delete many documents matching `filter` in all databases and return aggregated results.
     * @example
     * await User.finManyInAllDatabaseAndDelete({ expired: true });
     */
    findManyInAllDatabaseAndDelete(filter: any): Promise<any>;

    /**
     * Write a single document using round-robin balancing across writable DBs.
     * @example
     * const saved = await User.write({ name: 'Charlie' });
     */
    write(data: any): Promise<any>;

    /**
     * Perform efficient bulk upserts across writable DBs.
     * @example
     * await User.bulkWrite([{ id: '1', name: 'A' }], { batchSize: 500 });
     */
    bulkWrite(data: any[], options?: { batchSize?: number; concurrentBatches?: boolean }): Promise<any[]>;

    /**
     * Find a single document on a specific DB index.
     * @example
     * await User.findOne(0, { email: 'x' });
     */
    findOne(dbIndex: number, filter: any, chain?: any): Promise<any>;

    /**
     * Find documents on a specific DB index.
     * @example
     * await User.find(1, { active: true }, { limit: 10 });
     */
    find(dbIndex: number, filter: any, chain?: any): Promise<any>;

    /**
     * Find by id on a specific DB index.
     * @example
     * await User.findById(0, id);
     */
    findById(dbIndex: number, filter: any, chain?: any): Promise<any>;

    /**
     * Find by id and update on a specific DB index.
     * @example
     * await User.findByIdAndUpdate(0, id, { name: 'New' });
     */
    findByIdAndUpdate(dbIndex: number, id: any, update: any): Promise<any>;

    /**
     * Find by id and delete on a specific DB index.
     * @example
     * await User.findByIdAndDelete(1, id);
     */
    findByIdAndDelete(dbIndex: number, id: any, update?: any): Promise<any>;

    /**
     * Find one and update on a specific DB index.
     * @example
     * await User.findOneAndUpdate(0, { email: 'x' }, { active: false });
     */
    findOneAndUpdate(dbIndex: number, filter: any, update: any): Promise<any>;

    /**
     * Run aggregation on a specific DB index.
     * @example
     * await User.aggregate(0, [{ $group: { _id: '$country', count: { $sum: 1 } } }]);
     */
    aggregate(dbIndex: number, filter: any): Promise<any>;

    /**
     * Watch change stream on a specific DB index.
     * @example
     * const stream = User.watch(0);
     */
    watch(dbIndex: number): any;

    /**
     * Return the next model and its index for round-robin writes.
     * @example
     * const [model, idx] = User.getNextModel();
     */
    getNextModel(): [any, number];

    /**
     * Internal runner to execute many queries concurrently and return results with timing.
     */
    runLargeComputations(computationPairs: any[]): Promise<{ results: any[]; totalTime: number }>;
}
declare namespace Mongoplus {
    export { MongoModel };
}
export = Mongoplus;