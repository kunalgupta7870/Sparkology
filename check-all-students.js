// Check ALL students  
const { MongoClient } = require('mongodb');

async function checkAllStudents() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('erp');
    const collection = db.collection('students');
    
    const allStudents = await collection.find({}).toArray();
    console.log(`\n📊 Total students in database: ${allStudents.length}\n`);
    
    // Group by school
    const bySchool = {};
    allStudents.forEach(s => {
      const schoolId = s.schoolId?.toString() || 'no-school';
      if (!bySchool[schoolId]) bySchool[schoolId] = [];
      bySchool[schoolId].push(s);
    });
    
    Object.keys(bySchool).forEach(schoolId => {
      console.log(`\nSchool: ${schoolId} (${bySchool[schoolId].length} students)`);
      bySchool[schoolId].forEach(s => {
        console.log(`  - ${s.studentName || 'N/A'}: rollNumber=${s.rollNumber || '(null)'}, admission=${s.admissionNumber || '(null)'}`);
      });
    });

    // Specifically check for our target school
    const targetSchoolId = '6933078c75c51ca1c93cb732';
    const studentsInTarget = allStudents.filter(s => s.schoolId?.toString() === targetSchoolId);
    
    console.log(`\n\n🎯 Students in target school (${targetSchoolId}): ${studentsInTarget.length}`);
    
    // Check for null rollNumber in ANY school
    const nullRoll = allStudents.filter(s => s.rollNumber === null);
    console.log(`\n⚠️  Students with rollNumber === null: ${nullRoll.length}`);
    nullRoll.forEach(s => {
      console.log(`   - ${s.studentName || 'N/A'} in school ${s.schoolId?.toString() || 'no-school'}`);
    });

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAllStudents();
