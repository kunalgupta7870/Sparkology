const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lmsss-portal';

async function fixSubjectIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const subjectsCollection = db.collection('subjects');

    console.log('\n📋 Current indexes:');
    const currentIndexes = await subjectsCollection.indexes();
    currentIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop old problematic indexes
    console.log('\n🗑️  Dropping old indexes...');
    
    try {
      await subjectsCollection.dropIndex('code_1_schoolId_1');
      console.log('  ✅ Dropped: code_1_schoolId_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('  ℹ️  Index code_1_schoolId_1 does not exist (already dropped)');
      } else {
        console.log('  ⚠️  Error dropping code_1_schoolId_1:', error.message);
      }
    }

    try {
      await subjectsCollection.dropIndex('name_1_classId_1_schoolId_1');
      console.log('  ✅ Dropped: name_1_classId_1_schoolId_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('  ℹ️  Index name_1_classId_1_schoolId_1 does not exist (already dropped)');
      } else {
        console.log('  ⚠️  Error dropping name_1_classId_1_schoolId_1:', error.message);
      }
    }

    // Create new indexes
    console.log('\n✨ Creating new indexes...');
    
    // Index: name + classId + schoolId (unique, sparse)
    await subjectsCollection.createIndex(
      { name: 1, classId: 1, schoolId: 1 },
      { unique: true, sparse: true, name: 'name_1_classId_1_schoolId_1' }
    );
    console.log('  ✅ Created: name_1_classId_1_schoolId_1 (unique, sparse)');

    // Index: code + classId + schoolId (unique, sparse)
    await subjectsCollection.createIndex(
      { code: 1, classId: 1, schoolId: 1 },
      { unique: true, sparse: true, name: 'code_1_classId_1_schoolId_1' }
    );
    console.log('  ✅ Created: code_1_classId_1_schoolId_1 (unique, sparse)');

    console.log('\n📋 New indexes:');
    const newIndexes = await subjectsCollection.indexes();
    newIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('ℹ️  You can now create subjects with the same name in different classes.\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
console.log('🚀 Starting Subject Indexes Migration...\n');
fixSubjectIndexes();

