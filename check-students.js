// Check existing students
const { MongoClient } = require('mongodb');

async function checkStudents() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('erp');
    const collection = db.collection('students');
    
    const schoolId = '6933078c75c51ca1c93cb732';
    console.log('🔍 Searching for students with schoolId:', schoolId);
    
    const students = await collection.find({ schoolId: schoolId }).toArray();
    console.log(`\n📊 Found ${students.length} student(s) in this school\n`);
    
    students.forEach((s, idx) => {
      console.log(`${idx + 1}. Student:`);
      console.log(`   ID: ${s._id}`);
      console.log(`   Name: ${s.studentName || s.firstName} ${s.lastName || ''}`);
      console.log(`   Email: ${s.email}`);
      console.log(`   RollNumber: ${s.rollNumber || '(null/undefined)'}`);
      console.log(`   AdmissionNumber: ${s.admissionNumber || '(null/undefined)'}`);
      console.log('');
    });

    // Check if there are any with null rollNumber
    const nullRollStudents = await collection.find({ 
      schoolId: schoolId,
      rollNumber: null 
    }).toArray();
    
    console.log(`\n⚠️  Students with null rollNumber: ${nullRollStudents.length}`);
    nullRollStudents.forEach(s => {
      console.log(`   - ${s.studentName || s.firstName} (${s.email})`);
    });

    // Check with undefined
    const undefinedRollStudents = await collection.find({ 
      schoolId: schoolId,
      rollNumber: undefined 
    }).toArray();
    
    console.log(`\n⚠️  Students with undefined rollNumber: ${undefinedRollStudents.length}`);

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStudents();
