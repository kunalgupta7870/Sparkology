// Drop the problematic index from the correct database (erp)
const { MongoClient } = require('mongodb');

async function fixIndex() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected\n');

    const db = client.db('erp');
    const collection = db.collection('students');
    
    console.log('🗑️  Dropping index: rollNumber_1_schoolId_1 from erp.students');
    try {
      await collection.dropIndex('rollNumber_1_schoolId_1');
      console.log('✅ Index dropped successfully!\n');
    } catch (err) {
      console.log('❌ Error dropping index:', err.message);
      await client.close();
      process.exit(1);
    }

    // List all indexes now
    console.log('📋 Remaining indexes on erp.students:');
    const indexes = await collection.listIndexes().toArray();
    indexes.forEach(idx => {
      const unique = idx.unique ? '(unique)' : '';
      const sparse = idx.sparse ? '(sparse)' : '';
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${unique} ${sparse}`);
    });

    await client.close();
    console.log('\n✅ Index dropped! Now restart the backend server.');
    console.log('   The server will recreate it with sparse: true configuration.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixIndex();
