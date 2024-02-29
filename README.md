# mongoplusplus

## Overview

`mongoplusplus` is a Node.js package designed to facilitate load balancing of read and write operations across multiple MongoDB databases. It simplifies database connection management, schema definition, model building, and CRUD operations execution.

## Installation

Install mongoplusplus via npm:

```bash
npm install mongoplusplus
```

importing
```node
const mongoplusplus = require('mongoplusplus');
```
##Initialing
```node
const dbname = 'testforUP';

const mongoURI1 = `mongodb+srv://xxxxx:xxxxxx@cluster0.xxxxx.mongodb.net/${dbname}?retryWrites=true&w=majority`;
const mongoURI2 = `readonly:mongodb+srv://xxxxxxx:xxxxxx@cluster0.xxxxxx.mongodb.net/${dbname}?retryWrites=true&w=majority`;
const mongodb = new mongoplusplus([mongoURI1, mongoURI2]);

```
##connecting database
this is the top level thing in your main page (in this test code, under mongodb variable declaration  )
```node
(async () => {
  await mongodb.connectToAll();
})();
```
##Schema defining 
it is very  similar to Mongoose schema definition.but only one mandatory field must be there in the schema which will act as a db identifier for that document
```node
const likeSH = mongodb.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "users" },
  postId: { type: mongoose.Schema.Types.ObjectId, required: true  },
  dbIndex: { type: Number, required: true },

  like_time: { type: Date, default: Date.now }
}
)
```
### model building
```node
const likes = mongodb.buildModel("likes", likeSH)
```


##### Note that `dbIndex` is used to indicate which MongoDB server it belongs to.
###### it is a must otherwise it will throw an error.
```node
     throw new Error(`[!]Error :  < dbIndex > must be present in your schema like dbIndex:{
            type: Number,
            required: true
          } `)
```


### usage methods
```node 
findInAllDatabase(filter, chain = {})
```
Usage: Finds documents matching the filter in all MongoDB databases.

```node 
const result = await likes.findInAllDatabase({ name: 'John' }, { limit: 10, skip: 0 });
Returns: An array of documents matching the filter from all databases.
```
```node
writeInAllDatabase(data)

Usage: Writes data to all MongoDB databases.

const result = await likes.writeInAllDatabase({ name: 'John', age: 30 });
Returns: An array of written documents from all databases.
```
```node
UpdateOneInAllDatabase(filter, update)
Usage: Updates a single document matching the filter in all MongoDB databases.
const updatedDocument = await likes.UpdateOneInAllDatabase({ name: 'John' }, { age: 35 });
Returns: The updated document.
```
```node 
UpdateByIdInAllDatabase(id, update)
Usage: Updates a document by ID in all MongoDB databases.
const updatedDocument = await likes.UpdateByIdInAllDatabase('123456', { age: 35 });
Returns: The updated document.
```
```node 
findByIdInAllDatabaseAndDelete(id)
Usage: Finds a document by ID in all MongoDB databases and deletes it.
const deletedDocument = await likes.findByIdInAllDatabaseAndDelete('123456');
Returns: The deleted document.
```

```node 
findOneInAllDatabaseAndDelete(filter)
Usage: Finds a single document matching the filter in all MongoDB databases and deletes it.
const deletedDocument = await likes.findOneInAllDatabaseAndDelete({ name: 'John' });
Returns: The deleted document.
```
```node 
write(data)
Usage: Writes data to a MongoDB database.
const result = await likes.write({ name: 'John', age: 30 });
Returns: The written document.
```

```node 
findOne(dbIndex, filter, chain = {})
Usage: Finds a single document matching the filter in a specific MongoDB database.
const document = await likes.findOne(0, { name: 'John' }, { limit: 1 });
Returns: The found document.
```
```node
find(dbIndex, filter, chain = {})
Usage: Finds documents matching the filter in a specific MongoDB database.
const documents = await likes.find(0, { age: { $gt: 18 } }, { limit: 10 });
Returns: An array of found documents.
```

```node 
findById(dbIndex, id, chain = {})
Usage: Finds a document by ID in a specific MongoDB database.
const document = await likes.findById(0, '123456');
Returns: The found document.
```
```node
findByIdAndUpdate(dbIndex, id, update)
Usage: Finds a document by ID in a specific MongoDB database and updates it.
const updatedDocument = await likes.findByIdAndUpdate(0, '123456', { age: 35 });
Returns: The updated document.
```
```node
findByIdAndDelete(dbIndex, id)
Usage: Finds a document by ID in a specific MongoDB database and deletes it.
const deletedDocument = await likes.findByIdAndDelete(0, '123456');
Returns: The deleted document.
```
```node
findOneAndUpdate(dbIndex, filter, update)
Usage: Finds a single document matching the filter in a specific MongoDB database and updates it.

const updatedDocument = await likes.findOneAndUpdate(0, { name: 'John' }, { age: 35 });
Returns: The updated document.
```
```node
aggregate(dbIndex, filter)
Usage: Aggregates documents in a specific MongoDB database based on the filter.
const aggregationResult = await likes.aggregate(0, [{ $group: { _id: '$name', total: { $sum: '$age' } } }]);
Returns: The aggregation result.
```
```node
watch(dbIndex)
Usage: Starts watching for changes in a specific MongoDB database.
const watcher = await likes.watch(0);
Returns: A watcher object for the database.
```

> now most of the functionality is as same as mongoose  so you can use them directly like indexing a schema 
```node
likeSH.index({ user_id: 1, postId: 1 }, { unique: true });
```
# Contributing
there are many things that are not ported. feel free to contribute!
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. Please make sure to update.and also 