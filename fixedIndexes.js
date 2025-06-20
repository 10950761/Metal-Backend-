const mongoose = require('mongoose');
const Stock = require('./models/Stock');

// Use the exact connection string from your .env
mongoose.connect("mongodb+srv://gtawiah009:Ug10950761@cluster0.9scneih.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0");

mongoose.connection.once('open', async () => {
  console.log('✅ Connected to MongoDB');

  const indexes = await Stock.collection.indexes();
  console.log('\n📋 Current Indexes:');
  indexes.forEach((i) => {
    console.log(`- ${i.name}:`, i.key);
  });

  // Drop any old index on just productName
  for (const index of indexes) {
    const isBad = JSON.stringify(index.key) === JSON.stringify({ productName: 1 });
    if (isBad && index.name !== '_id_') {
      try {
        await Stock.collection.dropIndex(index.name);
        console.log(`Dropped broken index: ${index.name}`);
      } catch (err) {
        console.log(`Failed to drop ${index.name}:`, err.message);
      }
    }
  }

  // Ensure the correct compound index exists
  try {
    await Stock.collection.createIndex({ productName: 1, user: 1 }, { unique: true });
    console.log('✅ Created correct index: { productName: 1, user: 1 }');
  } catch (err) {
    console.log('⚠️ Error creating compound index:', err.message);
  }

  process.exit();
});
