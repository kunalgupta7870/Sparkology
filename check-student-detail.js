// Check student details
const { MongoClient, ObjectId } = require('mongodb');

async function checkStudent() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('erp');
    const collection = db.collection('students');
    
    // Find the latest student
    const student = await collection.findOne(
      { schoolId: new ObjectId('6933078c75c51ca1c93cb732') },
      { sort: { _id: -1 } }
    );
    
    if (!student) {
      console.log('❌ No student found');
      await client.close();
      process.exit(0);
    }

    console.log('✅ Found student:\n');
    console.log('ID:', student._id);
    console.log('Name:', student.studentName || 'N/A');
    console.log('Email:', student.email);
    console.log('Roll Number:',  student.hasOwnProperty('rollNumber') ? student.rollNumber : '(undefined/missing)');
    console.log('Full doc:', JSON.stringify(student, null, 2));

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStudent();
