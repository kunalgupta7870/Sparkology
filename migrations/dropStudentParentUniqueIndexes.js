const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lmsss-portal';

async function dropStudentParentUniqueIndexes() {
  try {
    console.log('🚀 Starting Student & Parent Unique Indexes Migration...\n');
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

    // Drop old unique indexes
    console.log('\n🗑️  Dropping old Student unique indexes...');
    
    const studentIndexesToDrop = ['email_1', 'rollNumber_1', 'admissionNumber_1'];
    
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

    // Create new compound unique indexes
    console.log('\n✨ Creating new Student compound unique indexes...');
    
    try {
      await studentsCollection.createIndex(
        { email: 1, schoolId: 1 },
        { unique: true, name: 'email_1_schoolId_1' }
      );
      console.log('  ✅ Created: email_1_schoolId_1 (unique)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index email_1_schoolId_1 already exists');
      } else {
        console.log('  ⚠️  Error creating email_1_schoolId_1:', error.message);
      }
    }

    try {
      await studentsCollection.createIndex(
        { rollNumber: 1, schoolId: 1 },
        { unique: true, name: 'rollNumber_1_schoolId_1' }
      );
      console.log('  ✅ Created: rollNumber_1_schoolId_1 (unique)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index rollNumber_1_schoolId_1 already exists');
      } else {
        console.log('  ⚠️  Error creating rollNumber_1_schoolId_1:', error.message);
      }
    }

    try {
      await studentsCollection.createIndex(
        { admissionNumber: 1, schoolId: 1 },
        { unique: true, name: 'admissionNumber_1_schoolId_1' }
      );
      console.log('  ✅ Created: admissionNumber_1_schoolId_1 (unique)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index admissionNumber_1_schoolId_1 already exists');
      } else {
        console.log('  ⚠️  Error creating admissionNumber_1_schoolId_1:', error.message);
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

    // Drop old unique index
    console.log('\n🗑️  Dropping old Parent unique index...');
    
    try {
      await parentsCollection.dropIndex('email_1');
      console.log('  ✅ Dropped: email_1');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('  ℹ️  Index email_1 does not exist (already dropped or never existed)');
      } else {
        console.log('  ⚠️  Error dropping email_1:', error.message);
      }
    }

    // Create new compound unique index
    console.log('\n✨ Creating new Parent compound unique index...');
    
    try {
      await parentsCollection.createIndex(
        { email: 1, schoolId: 1 },
        { unique: true, name: 'email_1_schoolId_1' }
      );
      console.log('  ✅ Created: email_1_schoolId_1 (unique)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index email_1_schoolId_1 already exists');
      } else {
        console.log('  ⚠️  Error creating email_1_schoolId_1:', error.message);
      }
    }

    console.log('\n📋 New Parent indexes:');
    const newParentIndexes = await parentsCollection.indexes();
    newParentIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
    });

    console.log('\n\n✅ Migration completed successfully!');
    console.log('ℹ️  Students and Parents can now have duplicate emails, roll numbers, and admission numbers across different schools.\n');

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
dropStudentParentUniqueIndexes();

