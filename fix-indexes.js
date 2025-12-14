// Script to fix the Student schema index issue
const mongoose = require('mongoose');

const mongoURI = 'mongodb://localhost:27017/lmsss-portal';

async function fixIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    const collection = mongoose.connection.collection('students');
    
    // List all indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.getIndexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Drop the problematic index if it exists
    try {
      console.log('\n🗑️  Dropping old index: rollNumber_1_schoolId_1');
      await collection.dropIndex('rollNumber_1_schoolId_1');
      console.log('✅ Dropped old index');
    } catch (err) {
      console.log('⚠️  Could not drop index (may not exist):', err.message);
    }

    // Create the new sparse index
    console.log('\n📝 Creating new sparse index...');
    await collection.createIndex(
      { rollNumber: 1, schoolId: 1 },
      { unique: true, sparse: true }
    );
    console.log('✅ Created new sparse index');

    // List all indexes again
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.getIndexes();
    console.log(JSON.stringify(finalIndexes, null, 2));

    console.log('\n✅ Index fix complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixIndexes();
