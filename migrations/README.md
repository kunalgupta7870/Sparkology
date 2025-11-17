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

### dropStudentParentUniqueIndexes.js
**Purpose**: Drops old global unique indexes and creates school-scoped compound unique indexes for Students and Parents.

**What it does**:
- **Student Collection**:
  - Drops old indexes: `email_1`, `rollNumber_1`, `admissionNumber_1` (globally unique)
  - Creates new indexes:
    - `email_1_schoolId_1` (unique per school)
    - `rollNumber_1_schoolId_1` (unique per school)
    - `admissionNumber_1_schoolId_1` (unique per school)
- **Parent Collection**:
  - Drops old index: `email_1` (globally unique)
  - Creates new index: `email_1_schoolId_1` (unique per school)

**When to run**: After updating the Student and Parent models to allow duplicate emails, roll numbers, and admission numbers across different schools.

**How to run**:
```bash
cd backend
node migrations/dropStudentParentUniqueIndexes.js
```

**Expected Output**:
```
🚀 Starting Student & Parent Unique Indexes Migration...
🔄 Connecting to MongoDB...
✅ Connected to MongoDB
📚 Processing STUDENT collection...
🗑️  Dropping old Student unique indexes...
✨ Creating new Student compound unique indexes...
👨‍👩‍👧 Processing PARENT collection...
🗑️  Dropping old Parent unique index...
✨ Creating new Parent compound unique index...
✅ Migration completed successfully!
```

### updateUserEmailPhoneToGlobalUnique.js
**Purpose**: Updates User model indexes to ensure email and phone are globally unique for teachers and all users.

**What it does**:
- **User Collection**:
  - Updates email index to be globally unique with sparse option
  - Creates phone index as globally unique with sparse option
  - Ensures teachers can have same names across schools but unique email/phone globally

**When to run**: After updating the User model to ensure email and phone uniqueness across all schools for teachers, librarians, accountants, etc.

**How to run**:
```bash
cd backend
node migrations/updateUserEmailPhoneToGlobalUnique.js
```

**Expected Output**:
```
🚀 Starting User Email & Phone Global Uniqueness Migration...
🔄 Connecting to MongoDB...
✅ Connected to MongoDB
👤 Processing USER collection...
✨ Creating/updating User globally unique indexes...
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

