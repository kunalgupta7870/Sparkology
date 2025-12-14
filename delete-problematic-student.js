// Delete the problematic student record
const { MongoClient, ObjectId } = require('mongodb');

async function deleteStudent() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('erp');
    const collection = db.collection('students');
    
    console.log('🗑️  Deleting student with rollNumber === null...');
    const result = await collection.deleteOne({
      schoolId: new ObjectId('6933078c75c51ca1c93cb732'),
      rollNumber: null
    });
    
    console.log('✅ Deleted', result.deletedCount, 'student(s)\n');

    // Verify
    const remaining = await collection.countDocuments();
    console.log('📊 Total students remaining:', remaining);

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteStudent();
