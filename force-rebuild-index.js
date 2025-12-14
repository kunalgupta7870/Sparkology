// Force drop and rebuild the index
const { MongoClient } = require('mongodb');

async function fixIndex() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('erp');
    const collection = db.collection('students');
    
    console.log('🗑️  Attempting to drop rollNumber_1_schoolId_1 index...');
    try {
      await collection.dropIndex('rollNumber_1_schoolId_1');
      console.log('✅ Index dropped\n');
    } catch (err) {
      console.log('⚠️  Error dropping:', err.message + '\n');
    }

    // Wait a moment
    await new Promise(r => setTimeout(r, 500));

    // Now try to create it with sparse: true explicitly
    console.log('🔧 Creating new sparse index...');
    const result = await collection.createIndex(
      { rollNumber: 1, schoolId: 1 },
      { unique: true, sparse: true, background: true }
    );
    console.log('✅ Index created:', result + '\n');

    // Verify
    const indexes = await collection.listIndexes().toArray();
    const ourIndex = indexes.find(i => i.name === 'rollNumber_1_schoolId_1');
    
    if (ourIndex) {
      console.log('✅ Verification:');
      console.log('  Key:', JSON.stringify(ourIndex.key));
      console.log('  Unique:', ourIndex.unique);
      console.log('  Sparse:', ourIndex.sparse);
    } else {
      console.log('❌ Index not found after creation!');
    }

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixIndex();
