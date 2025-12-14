// Check what's in MongoDB
const { MongoClient } = require('mongodb');

async function checkDB() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected\n');

    const admin = client.db().admin();
    
    // List all databases
    console.log('📊 All Databases:');
    const dbs = await admin.listDatabases();
    dbs.databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Now connect to lmsss-portal
    console.log('\n🔍 Checking lmsss-portal database...');
    const db = client.db('lmsss-portal');
    
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Collections in lmsss-portal:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    // If students exists, show its indexes
    const studentsColl = db.collection('students');
    try {
      const indexes = await studentsColl.listIndexes().toArray();
      console.log('\n🔑 Indexes on students collection:');
      indexes.forEach(idx => {
        console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
      });
    } catch (err) {
      console.log('⚠️  Could not list indexes:', err.message);
    }

    // Also check for "erp" database (since error shows erp.students)
    console.log('\n🔍 Checking erp database...');
    const erpDB = client.db('erp');
    const erpCollections = await erpDB.listCollections().toArray();
    console.log('\n📋 Collections in erp:');
    if (erpCollections.length === 0) {
      console.log('  (no collections)');
    } else {
      erpCollections.forEach(col => {
        console.log(`  - ${col.name}`);
      });

      // Check students collection in erp
      const erpStudents = erpDB.collection('students');
      try {
        const indexes = await erpStudents.listIndexes().toArray();
        console.log('\n🔑 Indexes on erp.students collection:');
        indexes.forEach(idx => {
          console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
        });
      } catch (err) {
        console.log('⚠️  Could not list indexes:', err.message);
      }
    }

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDB();
