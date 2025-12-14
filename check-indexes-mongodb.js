const { MongoClient } = require('mongodb');
require('dotenv').config({ path: './config.env' });

async function checkIndex() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('erp');
    const collection = db.collection('students');
    
    const indexes = await collection.listIndexes().toArray();
    console.log('All indexes for students collection (via MongoDB driver):');
    indexes.forEach((idx, i) => {
      if (idx.name.includes('rollNumber')) {
        console.log(`\nIndex ${i}: ${idx.name}`);
        console.log(JSON.stringify(idx, null, 2));
      }
    });
    
  } finally {
    await client.close();
  }
}

checkIndex();
