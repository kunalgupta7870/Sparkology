/*
  Seed script to populate SubjectCourse.skill based on subjectName.
  Usage:
    node backend/scripts/seedSubjectCourseSkills.js [--overwrite] [--dry-run]

  Env:
    - Uses backend .env if present (MONGO_URI or DB connection used by backend)
*/

const path = require('path');
const mongoose = require('mongoose');

// Load env from backend/.env if available
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (_) {}

// Fallback URI if none provided
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lmsss-portal" ;

// Models
const SubjectCourse = require('../models/SubjectCourse');

// CLI flags
const argv = process.argv.slice(2);
const OVERWRITE = argv.includes('--overwrite');
const DRY_RUN = argv.includes('--dry-run');

// Subject → Skill mapping (extend as needed)
const subjectToSkill = {
  mathematics: 'Algebra & Problem Solving',
  math: 'Algebra & Problem Solving',
  maths: 'Algebra & Problem Solving',
  physics: 'Scientific Reasoning',
  chemistry: 'Lab & Analytical Skills',
  biology: 'Scientific Inquiry',
  english: 'Reading & Communication',
  science: 'Scientific Literacy',
  geography: 'Spatial Reasoning',
  history: 'Historical Analysis',
  computer: 'Computational Thinking',
  'computer science': 'Computational Thinking',
  cs: 'Computational Thinking',
  hindi: 'Language Proficiency',
  art: 'Creativity & Design',
  music: 'Musical Literacy',
  pe: 'Fitness & Teamwork',
  'physical education': 'Fitness & Teamwork',
};

function inferSkillFromSubject(subjectName) {
  if (!subjectName || typeof subjectName !== 'string') return 'Course Completion';
  const key = subjectName.trim().toLowerCase();
  return subjectToSkill[key] || 'Course Completion';
}

async function main() {
  const startedAt = new Date();
  console.log('🔧 SubjectCourse Skill Seeder');
  console.log('   URI:', MONGO_URI.replace(/:\/\/.*@/, '://***:***@'));
  console.log('   Flags:', { OVERWRITE, DRY_RUN });

  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    const courses = await SubjectCourse.find({}).select('_id subjectName skill title');
    console.log(`🔎 Found ${courses.length} subject courses`);

    const ops = [];
    let skipped = 0;
    let updated = 0;
    let unchanged = 0;

    for (const course of courses) {
      const current = (course.skill || '').trim();
      const inferred = inferSkillFromSubject(course.subjectName);

      if (current && !OVERWRITE) {
        skipped++;
        continue;
      }

      if (!OVERWRITE && current === '') {
        if (current === inferred) {
          unchanged++;
          continue;
        }
      }

      if (current === inferred && OVERWRITE) {
        unchanged++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`· Would set skill for ${course._id} (${course.title}) → "${inferred}"`);
        updated++;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: course._id },
          update: { $set: { skill: inferred } },
        },
      });
      updated++;
    }

    if (!DRY_RUN && ops.length > 0) {
      const res = await SubjectCourse.bulkWrite(ops, { ordered: false });
      console.log('✅ Bulk update result:', {
        matched: res.matchedCount,
        modified: res.modifiedCount,
        upserts: res.upsertedCount,
      });
    }

    const endedAt = new Date();
    console.log('📊 Summary:', { total: courses.length, updated, skipped, unchanged, DRY_RUN, OVERWRITE });
    console.log(`⏱️ Duration: ${((endedAt - startedAt) / 1000).toFixed(2)}s`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();


