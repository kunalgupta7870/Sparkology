const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

async function rebuildIndex() {
  try {
    console.log('Connecting to MongoDB at:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('Dropping old rollNumber index...');
    try {
      await db.collection('students').dropIndex('rollNumber_1_schoolId_1');
      console.log('✓ Old index dropped successfully');
    } catch (err) {
      if (err.message.includes('index not found')) {
        console.log('✓ Old index not found (already dropped)');
      } else {
        throw err;
      }
    }

    // Force Mongoose to create the new index from the schema definition
    console.log('Creating new partial index with partialFilterExpression...');
    const Student = require('./models/Student');
    
    // Drop all indexes and recreate from schema
    try {
      await db.collection('students').dropIndexes();
      console.log('✓ All indexes dropped');
    } catch (err) {
      if (err.message.includes('cannot drop _id index')) {
        console.log('✓ All indexes except _id dropped');
      } else {
        throw err;
      }
    }

    // Force Mongoose to build indexes
    await Student.syncIndexes();
    console.log('✓ Indexes synced from schema definition');

    // Verify the index
    const indexes = await Student.collection.getIndexes();
    console.log('\nAll indexes:');
    for (const [name, spec] of Object.entries(indexes)) {
      if (name.includes('rollNumber')) {
        console.log(`\n${name}:`);
        console.log(JSON.stringify(spec, null, 2));
      }
    }

    console.log('\n✓ Index rebuild complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

rebuildIndex();
