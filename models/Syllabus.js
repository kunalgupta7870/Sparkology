const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Chapter title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    required: true
  },
  topics: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    duration: {
      hours: { type: Number, default: 0 },
      minutes: { type: Number, default: 0 }
    },
    learningObjectives: [{
      type: String,
      trim: true
    }],
    teachingMethodology: [{
      type: String,
      enum: ['lecture', 'practical', 'discussion', 'project', 'activity', 'presentation', 'other']
    }],
    resources: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      type: {
        type: String,
        enum: ['textbook', 'reference', 'website', 'video', 'worksheet', 'assessment', 'other'],
        default: 'other'
      },
      url: String,
      description: String
    }],
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending'
    },
    completionDate: Date
  }],
  startDate: Date,
  endDate: Date,
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  }
});

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
  title: {
    type: String,
    required: [true, 'Syllabus title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  chapters: [chapterSchema],
  courseObjectives: [{
    type: String,
    trim: true
  }],
  prerequisites: [{
    type: String,
    trim: true
  }],
  courseMaterials: [{
    type: {
      type: String,
      enum: ['textbook', 'reference', 'workbook', 'digital'],
      required: true
    },
    title: String,
    author: String,
    publisher: String,
    edition: String,
    isbn: String,
    required: {
      type: Boolean,
      default: true
    }
  }],
  assessmentPattern: {
    continuous: {
      weightage: {
        type: Number,
        min: 0,
        max: 100
      },
      components: [{
        type: {
          type: String,
          enum: ['quiz', 'assignment', 'project', 'presentation', 'class-participation', 'other']
        },
        weightage: Number,
        minimumMarks: Number
      }]
    },
    termEnd: {
      weightage: {
        type: Number,
        min: 0,
        max: 100
      },
      components: [{
        type: {
          type: String,
          enum: ['written', 'practical', 'viva', 'project', 'other']
        },
        weightage: Number,
        minimumMarks: Number
      }]
    }
  },
  documents: [{
    name: String,
    description: String,
    type: {
      type: String,
      enum: ['syllabus', 'curriculum', 'lesson-plan', 'assessment-plan', 'other']
    },
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  approvalStatus: {
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalDate: Date,
    comments: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  version: {
    type: Number,
    default: 1
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
syllabusSchema.index({ schoolId: 1, classId: 1, subjectId: 1, academicYear: 1 });
syllabusSchema.index({ schoolId: 1, 'approvalStatus.status': 1 });
syllabusSchema.index({ teacherId: 1, status: 1 });

// Virtual for progress tracking
syllabusSchema.virtual('progress').get(function() {
  if (!this.chapters || this.chapters.length === 0) return 0;
  
  const completedTopics = this.chapters.reduce((acc, chapter) => {
    return acc + (chapter.topics || []).filter(topic => topic.status === 'completed').length;
  }, 0);
  
  const totalTopics = this.chapters.reduce((acc, chapter) => {
    return acc + (chapter.topics || []).length;
  }, 0);
  
  return totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
});

// Virtual for total duration
syllabusSchema.virtual('totalDuration').get(function() {
  return this.chapters.reduce((acc, chapter) => {
    return acc + (chapter.topics || []).reduce((topicAcc, topic) => {
      return topicAcc + (topic.duration.hours || 0) + (topic.duration.minutes || 0) / 60;
    }, 0);
  }, 0);
});
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

