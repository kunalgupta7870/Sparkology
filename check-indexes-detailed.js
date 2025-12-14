const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

async function checkIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Student = require('./models/Student');
    
    const result = await Student.collection.getIndexes();
    console.log('All indexes for students collection:');
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkIndex();
