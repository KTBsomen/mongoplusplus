import mongoose = require('mongoose');

/**
 * Mongoplus manages multiple mongoose connections and builds distributed models.
 *
 * Usage example:
 * ```js
 * const Mongoplus = require('mongoplus');
 * const mp = new Mongoplus(['mongodb://host1/db', 'readonly:mongodb://host2/db']);
 * await mp.connectToAll();
 * const User = mp.buildModel('User', new mp.Schema({ name: String, dbIndex: { type: Number, required: true } }));
 * await User.write({ name: 'Alice' });
 * ```
 */
declare class Mongoplus {
    /** Array of connection URIs. Prefix a URI with `readonly:` to mark it read-only. */
    mongoURI: string[];
    /** All mongoose connections created by `connectToAll`. */
    allConnections: mongoose.Connection[];
    /** Internal rotation index used by `getNextMongoURI`. */
    currentIndex: number;
    /** Connections that were created from `readonly:` URIs. */
    static readonlydbs: mongoose.Connection[];
    /** Models corresponding to readonly connections. */
    static readonlymodels: any[];

    /**
     * Create a Mongoplus manager.
     * @param mongoURI - Array of MongoDB URIs. Use `readonly:` prefix for read-only replicas.
     */
    constructor(mongoURI: string[]);

    /** Create a mongoose Schema from a plain definition. */
    Schema(schema: mongoose.SchemaDefinition | mongoose.Schema): mongoose.Schema;

    /** Add an index to a schema. Delegates to `schema.index(...)`. */
    addIndex(schema: mongoose.Schema, indextype: any): any;

    /** Return next MongoDB URI in rotation (without `readonly:` prefix). */
    getNextMongoURI(): string;

    /**
     * Establish all connections from `mongoURI`. Returns an array of mongoose.Connection.
     * Call this before `buildModel`.
     */
    connectToAll(): mongoose.Connection[];

    /**
     * Build a distributed model across all connections.
     * The provided `schema` must include a required numeric `dbIndex` field.
     */
    buildModel(name: string, schema: mongoose.Schema): MongoModel;
}

/**
 * MongoModel represents the model instances distributed across multiple databases.
 * Methods with `InAllDatabase` perform the operation on every connection and return aggregated results.
 */
declare class MongoModel {
    /** Array of mongoose models (one per connection). */
    model: any[];
    /** Read-only model references. */
    readonlydbs: any[];
    /** Original schema used to create the models. */
    s: mongoose.Schema;
    /** Rotation index for `write` balancing. */
    static currentIndex: number;

    /**
     * @param model - array of mongoose Model instances (one per connection)
     * @param s - mongoose Schema used to create models
     * @param readonlydbs - list of models that are read-only
     */
    constructor(model: any[], s: mongoose.Schema, readonlydbs: any[]);

    /** Find matching documents in all databases.
     * @param filter - mongoose filter
     * @param chain - optional chaining options (skip, limit, sort)
     */
    findInAllDatabase(filter: any, chain?: any): Promise<any>;

    /** Run aggregation pipeline on all databases. */
    aggregateInAllDatabase(filter: any, chain?: any): Promise<any>;

    /** Write the same document to all writable databases. Returns an array of saved docs. */
    writeInAllDatabase(data: any): Promise<any[]>;

    /** Update one matching document across all databases. */
    UpdateOneInAllDatabase(filter: any, update: any): Promise<any>;

    /** Update by id across all databases. */
    UpdateByIdInAllDatabase(id: any, update: any): Promise<any>;

    /** Find by id in all DBs and delete. */
    findByIdInAllDatabaseAndDelete(id: any): Promise<any>;

    /** Find one in all DBs and delete. */
    findOneInAllDatabaseAndDelete(filter: any): Promise<any>;

    /** Write a single document using round-robin balancing across writable DBs. */
    write(data: any): Promise<any>;

    /**
     * Perform efficient bulk upserts across writable DBs.
     * @param data - array of objects to upsert
     * @param options - optional settings: `batchSize` and `concurrentBatches`
     */
    bulkWrite(data: any[], options?: { batchSize?: number; concurrentBatches?: boolean }): Promise<any[]>;

    /** Find a single document on a specific DB index. */
    findOne(dbIndex: number, filter: any, chain?: any): Promise<any>;

    /** Find documents on a specific DB index. */
    find(dbIndex: number, filter: any, chain?: any): Promise<any>;

    /** Find by id on a specific DB index. */
    findById(dbIndex: number, filter: any, chain?: any): Promise<any>;

    /** Find by id and update on a specific DB index. */
    findByIdAndUpdate(dbIndex: number, id: any, update: any): Promise<any>;

    /** Find by id and delete on a specific DB index. */
    findByIdAndDelete(dbIndex: number, id: any, update?: any): Promise<any>;

    /** Find one and update on a specific DB index. */
    findOneAndUpdate(dbIndex: number, filter: any, update: any): Promise<any>;

    /** Run aggregation on a specific DB index. */
    aggregate(dbIndex: number, filter: any): Promise<any>;

    /** Watch change stream on a specific DB index. */
    watch(dbIndex: number): any;

    /** Return the next model and its index for round-robin writes. */
    getNextModel(): [any, number];

    /** Internal runner to execute many queries concurrently and return results with timing. */
    runLargeComputations(computationPairs: any[]): Promise<{ results: any[]; totalTime: number }>;
}

declare namespace Mongoplus { }

export = Mongoplus;

