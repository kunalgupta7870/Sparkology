// Check if the index is now sparse
const { MongoClient } = require('mongodb');

async function checkIndexDetail() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('erp');
    const collection = db.collection('students');
    
    const indexes = await collection.listIndexes().toArray();
    
    console.log('🔍 Full index details:\n');
    indexes.forEach(idx => {
      if (idx.name === 'rollNumber_1_schoolId_1') {
        console.log(`✅ Found rollNumber_1_schoolId_1 index:`);
        console.log(`   Keys: ${JSON.stringify(idx.key)}`);
        console.log(`   Unique: ${idx.unique}`);
        console.log(`   Sparse: ${idx.sparse}`);
        console.log(`   All props: ${JSON.stringify(idx, null, 2)}`);
      }
    });

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkIndexDetail();
