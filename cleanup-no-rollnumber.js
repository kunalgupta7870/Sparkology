const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: './config.env' });

async function cleanup() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('erp');
    const collection = db.collection('students');
    
    const schoolId = new ObjectId('6933078c75c51ca1c93cb732');
    
    console.log('Finding students without rollNumber...');
    const result = await collection.deleteMany({
      schoolId: schoolId,
      rollNumber: { $exists: false }
    });
    
    console.log(`✓ Deleted ${result.deletedCount} students without rollNumber field`);
    
  } finally {
    await client.close();
  }
}

cleanup();
