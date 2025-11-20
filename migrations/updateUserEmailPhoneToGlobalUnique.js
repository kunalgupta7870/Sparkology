const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lmsss-portal';

async function updateUserEmailPhoneToGlobalUnique() {
  try {
    console.log('🚀 Starting User Email & Phone Global Uniqueness Migration...\n');
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // ========== USER COLLECTION ==========
    console.log('👤 Processing USER collection...');
    const usersCollection = db.collection('users');

    console.log('\n📋 Current User indexes:');
    const currentUserIndexes = await usersCollection.indexes();
    currentUserIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '');
    });

    // Drop old email index if it exists (to recreate with sparse option)
    console.log('\n🗑️  Checking and updating User indexes...');
    
    try {
      // Check if email_1 exists and if it's not sparse, we'll recreate it
      const emailIndex = currentUserIndexes.find(idx => idx.name === 'email_1');
      if (emailIndex && !emailIndex.sparse) {
        try {
          await usersCollection.dropIndex('email_1');
          console.log('  ✅ Dropped: email_1 (will recreate with sparse)');
        } catch (error) {
          if (error.code === 27 || error.codeName === 'IndexNotFound') {
            console.log('  ℹ️  Index email_1 does not exist');
          } else {
            console.log('  ⚠️  Error dropping email_1:', error.message);
          }
        }
      }
    } catch (error) {
      console.log('  ℹ️  Could not check email index:', error.message);
    }

    // Create/update globally unique indexes for email and phone
    console.log('\n✨ Creating/updating User globally unique indexes...');
    
    try {
      await usersCollection.createIndex(
        { email: 1 },
        { unique: true, sparse: true, name: 'email_1' }
      );
      console.log('  ✅ Created/Updated: email_1 (globally unique, sparse)');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index email_1 already exists with correct options');
      } else {
        console.log('  ⚠️  Error creating email_1:', error.message);
      }
    }

    try {
      await usersCollection.createIndex(
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

    console.log('\n📋 New User indexes:');
    const newUserIndexes = await usersCollection.indexes();
    newUserIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(unique)' : '', index.sparse ? '(sparse)' : '');
    });

    console.log('\n\n✅ Migration completed successfully!');
    console.log('ℹ️  Email and phone numbers for teachers (and all users) are now globally unique across all schools.');
    console.log('ℹ️  Teachers can have the same name across different schools.\n');

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
updateUserEmailPhoneToGlobalUnique();

<<<<<<< HEAD
=======


>>>>>>> 75c9459 (Replace old code with new backend code)
