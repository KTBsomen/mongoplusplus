const mongoose = require('mongoose');
const Mongoplus = require('./mongoplus'); // Hypothetical library
// Performance comparison example
async function performanceComparison() {
    const mongoplus = new Mongoplus([
        'mongodb+srv://xxxxxxxxxxxxxxxxxxxxxxxxxx/testbulkwrite?retryWrites=true&w=majority',
        'mongodb+srv://xxxxxxxxxxxxxxxxxxxxxxxxxx/testbulkwrite?retryWrites=true&w=majority',
        'readonly:mongodb+srv://xxxxxxxxxxxxxxxxx/testbulkwrite?retryWrites=true&w=majority'
    ]);

    await mongoplus.connectToAll();

    const schema = mongoplus.Schema({
        name: String,
        email: String,
        age: Number,
        dbIndex: { type: Number, required: true }
    });

    const UserModel = mongoplus.buildModel('UserBulkWrite', schema);
    const testData = Array.from({ length: 10000 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 50)
    }));

    // Test 1: Large batch, concurrent
    console.time('Large batch concurrent');
    await UserModel.bulkWrite(testData, {
        batchSize: 5000,
        concurrentBatches: true
    });
    console.timeEnd('Large batch concurrent');

    // Test 2: Small batch, concurrent
    console.time('Small batch concurrent');
    await UserModel.bulkWrite(testData, {
        batchSize: 500,
        concurrentBatches: true
    });
    console.timeEnd('Small batch concurrent');

    // Test 3: Small batch, sequential
    console.time('Small batch sequential');
    await UserModel.bulkWrite(testData, {
        batchSize: 500,
        concurrentBatches: false
    });
    console.timeEnd('Small batch sequential');
}
performanceComparison().then(() => {
    console.log('Performance comparison completed.');
    process.exit(0);
}).catch(err => {
    console.error('Error during performance comparison:', err);
    process.exit(1);
});