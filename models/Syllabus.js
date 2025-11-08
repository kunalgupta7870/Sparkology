const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required']
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject ID is required']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  syllabusContent: {
    type: String,
    required: [true, 'Syllabus content is required'],
    trim: true
  },
  topics: [{
    topic: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  learningObjectives: [{
    type: String,
    trim: true
  }],
  assessmentCriteria: {
    type: String,
    trim: true
  },
  resources: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['textbook', 'reference', 'website', 'video', 'other'],
      default: 'other'
    },
    url: {
      type: String,
      trim: true
    }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
syllabusSchema.index({ schoolId: 1 });
syllabusSchema.index({ classId: 1 });
syllabusSchema.index({ subjectId: 1 });
syllabusSchema.index({ teacherId: 1 });
syllabusSchema.index({ academicYear: 1 });
// Ensure unique syllabus per class-subject-teacher-academic year combination
// Note: teacherId can be null, so we use sparse index
syllabusSchema.index({ classId: 1, subjectId: 1, teacherId: 1, academicYear: 1, schoolId: 1 }, { unique: true, sparse: true });

// Static method to get syllabus by class and subject
syllabusSchema.statics.getSyllabusByClassAndSubject = function(classId, subjectId, academicYear) {
  return this.findOne({ 
    classId, 
    subjectId, 
    academicYear,
    status: 'active' 
  })
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('teacherId', 'name email')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
};

// Static method to get all syllabus by class
syllabusSchema.statics.getSyllabusByClass = function(classId, academicYear) {
  return this.find({ 
    classId, 
    academicYear,
    status: 'active' 
  })
    .populate('subjectId', 'name code')
    .populate('teacherId', 'name email')
    .sort({ 'subjectId.name': 1 });
};

// Static method to get all syllabus by subject
syllabusSchema.statics.getSyllabusBySubject = function(subjectId, academicYear) {
  return this.find({ 
    subjectId, 
    academicYear,
    status: 'active' 
  })
    .populate('classId', 'name section')
    .populate('teacherId', 'name email')
    .sort({ 'classId.name': 1 });
};

module.exports = mongoose.model('Syllabus', syllabusSchema);

