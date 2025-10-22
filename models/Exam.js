const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Exam name is required'],
    trim: true
  },
  examType: {
    type: String,
    required: [true, 'Exam type is required'],
    enum: ['Mid Term', 'Final Term', 'Unit Test', 'Quiz', 'Monthly Test', 'Other']
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject is required']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  examDate: {
    type: Date,
    required: [true, 'Exam date is required']
  },
  examTime: {
    type: String,
    required: [true, 'Exam time is required']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: 1
  },
  totalMarks: {
    type: Number,
    required: [true, 'Total marks is required'],
    min: 1
  },
  passingMarks: {
    type: Number,
    default: function() {
      return this.totalMarks * 0.33; // 33% by default
    }
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  syllabusTopics: [{
    type: String
  }],
  instructions: [{
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
examSchema.index({ schoolId: 1, classId: 1 });
examSchema.index({ schoolId: 1, subjectId: 1 });
examSchema.index({ schoolId: 1, startDate: 1 });
examSchema.index({ schoolId: 1, status: 1 });

// Virtual for getting exam marks
examSchema.virtual('marks', {
  ref: 'ExamMark',
  localField: '_id',
  foreignField: 'examId'
});

// Ensure virtuals are included when converting to JSON
examSchema.set('toJSON', { virtuals: true });
examSchema.set('toObject', { virtuals: true });

// Pre-save middleware to update status based on dates
examSchema.pre('save', function(next) {
  const now = new Date();
  if (this.status !== 'cancelled') {
    if (now < this.startDate) {
      this.status = 'upcoming';
    } else if (now >= this.startDate && now <= this.endDate) {
      this.status = 'ongoing';
    } else if (now > this.endDate) {
      this.status = 'completed';
    }
  }
  next();
});

const Exam = mongoose.model('Exam', examSchema);

module.exports = Exam;

