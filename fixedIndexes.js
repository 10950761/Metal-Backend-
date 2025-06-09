const mongoose = require('mongoose');
const Stock = require('./models/Stock');

mongoose.connect('mongodb://localhost:27017/test');

mongoose.connection.once('open', async () => {
  console.log('Connected to DB');

  const indexes = await Stock.collection.indexes();
  console.log('Current Indexes:', indexes);

  try {
    await Stock.collection.dropIndex('productName_1');
    console.log('Dropped bad index: productName_1');
  } catch (err) {
    console.log('Could not drop productName_1 index (might not exist):', err.message);
  }

  await Stock.collection.createIndex({ productName: 1, user: 1 }, { unique: true });
  console.log('Created correct compound index: { productName, user }');

  process.exit();
});