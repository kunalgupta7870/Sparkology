const mongoose = require('mongoose');

const examMarkSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: [true, 'Exam is required'],
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student is required'],
    index: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  marksObtained: {
    type: Number,
    required: [true, 'Marks obtained is required'],
    min: 0
  },
  totalMarks: {
    type: Number,
    required: [true, 'Total marks is required'],
    min: 1
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  grade: {
    type: String,
    trim: true
  },
  remarks: {
    type: String,
    trim: true
  },
  isAbsent: {
    type: Boolean,
    default: false
  },
  isPassed: {
    type: Boolean,
    default: true
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index to ensure unique mark entry per student per exam
examMarkSchema.index({ examId: 1, studentId: 1 }, { unique: true });
examMarkSchema.index({ schoolId: 1, studentId: 1 });
examMarkSchema.index({ schoolId: 1, classId: 1 });

// Pre-save middleware to calculate percentage and grade
examMarkSchema.pre('save', async function(next) {
  // Calculate percentage
  if (!this.isAbsent && this.marksObtained !== undefined && this.totalMarks) {
    this.percentage = (this.marksObtained / this.totalMarks) * 100;
    
    // Calculate grade based on percentage
    if (this.percentage >= 90) {
      this.grade = 'A+';
    } else if (this.percentage >= 80) {
      this.grade = 'A';
    } else if (this.percentage >= 70) {
      this.grade = 'B+';
    } else if (this.percentage >= 60) {
      this.grade = 'B';
    } else if (this.percentage >= 50) {
      this.grade = 'C';
    } else if (this.percentage >= 40) {
      this.grade = 'D';
    } else if (this.percentage >= 33) {
      this.grade = 'E';
    } else {
      this.grade = 'F';
      this.isPassed = false;
    }
    
    // Check if passed based on exam's passing marks
    try {
      const Exam = mongoose.model('Exam');
      const exam = await Exam.findById(this.examId);
      if (exam && exam.passingMarks) {
        this.isPassed = this.marksObtained >= exam.passingMarks;
      }
    } catch (error) {
      console.error('Error fetching exam for passing marks:', error);
    }
  } else if (this.isAbsent) {
    this.percentage = 0;
    this.grade = 'Ab';
    this.isPassed = false;
  }
  
  next();
});

const ExamMark = mongoose.model('ExamMark', examMarkSchema);

module.exports = ExamMark;

