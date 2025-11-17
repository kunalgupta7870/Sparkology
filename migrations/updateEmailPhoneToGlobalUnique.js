const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lmsss-portal';

async function updateEmailPhoneToGlobalUnique() {
  try {
    console.log('🚀 Starting Email & Phone Global Uniqueness Migration...\n');
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // ========== STUDENT COLLECTION ==========
    console.log('📚 Processing STUDENT collection...');
    const studentsCollection = db.collection('students');

    console.log('\n📋 Current Student indexes:');
    const currentStudentIndexes = await studentsCollection.indexes();
    currentStudentIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
    });

    // Drop old compound indexes
    console.log('\n🗑️  Dropping old Student compound indexes...');
    
    const studentIndexesToDrop = ['email_1_schoolId_1'];
    
    for (const indexName of studentIndexesToDrop) {
      try {
        await studentsCollection.dropIndex(indexName);
        console.log(`  ✅ Dropped: ${indexName}`);
      } catch (error) {
        if (error.code === 27 || error.codeName === 'IndexNotFound') {
          console.log(`  ℹ️  Index ${indexName} does not exist (already dropped or never existed)`);
        } else {
          console.log(`  ⚠️  Error dropping ${indexName}:`, error.message);
        }
      }
    }

    // Create new globally unique indexes for email and phone
    console.log('\n✨ Creating new Student globally unique indexes...');
    
    try {
      await studentsCollection.createIndex(
        { email: 1 },
        { unique: true, sparse: true, name: 'email_1' }
      );
      console.log('  ✅ Created: email_1 (globally unique, sparse)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index email_1 already exists');
      } else {
        console.log('  ⚠️  Error creating email_1:', error.message);
      }
    }

    try {
      await studentsCollection.createIndex(
        { phone: 1 },
        { unique: true, sparse: true, name: 'phone_1' }
      );
      console.log('  ✅ Created: phone_1 (globally unique, sparse)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index phone_1 already exists');
      } else {
        console.log('  ⚠️  Error creating phone_1:', error.message);
      }
    }

    console.log('\n📋 New Student indexes:');
    const newStudentIndexes = await studentsCollection.indexes();
    newStudentIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
    });

    // ========== PARENT COLLECTION ==========
    console.log('\n\n👨‍👩‍👧 Processing PARENT collection...');
    const parentsCollection = db.collection('parents');

    console.log('\n📋 Current Parent indexes:');
    const currentParentIndexes = await parentsCollection.indexes();
    currentParentIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
    });

    // Drop old compound index
    console.log('\n🗑️  Dropping old Parent compound index...');
    
    try {
      await parentsCollection.dropIndex('email_1_schoolId_1');
      console.log('  ✅ Dropped: email_1_schoolId_1');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('  ℹ️  Index email_1_schoolId_1 does not exist (already dropped or never existed)');
      } else {
        console.log('  ⚠️  Error dropping email_1_schoolId_1:', error.message);
      }
    }

    // Create new globally unique indexes for email and phone
    console.log('\n✨ Creating new Parent globally unique indexes...');
    
    try {
      await parentsCollection.createIndex(
        { email: 1 },
        { unique: true, sparse: true, name: 'email_1' }
      );
      console.log('  ✅ Created: email_1 (globally unique, sparse)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index email_1 already exists');
      } else {
        console.log('  ⚠️  Error creating email_1:', error.message);
      }
    }

    try {
      await parentsCollection.createIndex(
        { phone: 1 },
        { unique: true, sparse: true, name: 'phone_1' }
      );
      console.log('  ✅ Created: phone_1 (globally unique, sparse)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index phone_1 already exists');
      } else {
        console.log('  ⚠️  Error creating phone_1:', error.message);
      }
    }

    console.log('\n📋 New Parent indexes:');
    const newParentIndexes = await parentsCollection.indexes();
    newParentIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
    });

    console.log('\n\n✅ Migration completed successfully!');
    console.log('ℹ️  Email and phone numbers are now globally unique across all schools.');
    console.log('ℹ️  Roll numbers and admission numbers remain unique per school.\n');

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
updateEmailPhoneToGlobalUnique();

