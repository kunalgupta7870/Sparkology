# Database Migrations

This directory contains database migration scripts for the LMS Backend.

## Available Migrations

### fixSubjectIndexes.js
**Purpose**: Fixes subject indexes to allow same subject names/codes across different classes.

**What it does**:
- Drops old indexes: `code_1_schoolId_1` and `name_1_classId_1_schoolId_1`
- Creates new indexes: 
  - `name_1_classId_1_schoolId_1` (unique per class)
  - `code_1_classId_1_schoolId_1` (unique per class)

**When to run**: After updating the Subject model to allow duplicate subject names in different classes.

**How to run**:
```bash
cd backend
node migrations/fixSubjectIndexes.js
```

**Expected Output**:
```
🚀 Starting Subject Indexes Migration...
🔄 Connecting to MongoDB...
✅ Connected to MongoDB
📋 Current indexes...
🗑️  Dropping old indexes...
✨ Creating new indexes...
✅ Migration completed successfully!
```

## Creating New Migrations

When creating new migrations:
1. Create a descriptive filename (e.g., `addNewFieldToModel.js`)
2. Include clear console logging
3. Handle errors gracefully
4. Always close the MongoDB connection
5. Document the migration in this README

## Notes
- Migrations are run manually, not automatically
- Always backup your database before running migrations
- Test migrations in development first

