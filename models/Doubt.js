const mongoose = require('mongoose');

const doubtSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student is required']
  },
  subjectCourse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectCourse',
    required: [true, 'Subject course is required']
  },
  subjectName: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  question: {
    type: String,
    required: [true, 'Question is required'],
    trim: true,
    maxlength: [2000, 'Question cannot exceed 2000 characters']
  },
  document: {
    url: {
      type: String,
      trim: true
    },
    publicId: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      trim: true
    }
  },
  answer: {
    text: {
      type: String,
      trim: true,
      maxlength: [5000, 'Answer cannot exceed 5000 characters']
    },
    answeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    answeredAt: {
      type: Date
    }
  },
  status: {
    type: String,
    enum: ['pending', 'answered'],
    default: 'pending'
  },
  views: {
    type: Number,
    default: 0
  },
  helpful: {
    type: Number,
    default: 0
  },
  isBookmarked: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  className: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
doubtSchema.index({ student: 1 });
doubtSchema.index({ subjectCourse: 1 });
doubtSchema.index({ schoolId: 1 });
doubtSchema.index({ status: 1 });
doubtSchema.index({ createdAt: -1 });
doubtSchema.index({ helpful: -1 });

// Virtual for bookmarked count
doubtSchema.virtual('bookmarkedCount').get(function() {
  return this.isBookmarked ? this.isBookmarked.length : 0;
});

// Static method to get popular doubts (answered and sorted by helpful count)
doubtSchema.statics.getPopularDoubts = function(filters = {}) {
  return this.find({ 
    status: 'answered',
    ...filters 
  })
    .sort({ helpful: -1, views: -1 })
    .populate('student', 'name email')
    .populate('subjectCourse', 'title subjectName')
    .populate('answer.answeredBy', 'name email');
};

// Static method to get recent doubts (answered and sorted by date)
doubtSchema.statics.getRecentDoubts = function(filters = {}) {
  return this.find({ 
    status: 'answered',
    ...filters 
  })
    .sort({ 'answer.answeredAt': -1 })
    .populate('student', 'name email')
    .populate('subjectCourse', 'title subjectName')
    .populate('answer.answeredBy', 'name email');
};

// Static method to get pending doubts (for master portal)
doubtSchema.statics.getPendingDoubts = function(filters = {}) {
  return this.find({ 
    status: 'pending',
    ...filters 
  })
    .sort({ createdAt: -1 })
    .populate('student', 'name email className')
    .populate('subjectCourse', 'title subjectName className');
};

// Instance method to increment views
doubtSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Instance method to increment helpful count
doubtSchema.methods.markHelpful = function() {
  this.helpful += 1;
  return this.save();
};

// Instance method to toggle bookmark
doubtSchema.methods.toggleBookmark = function(studentId) {
  const index = this.isBookmarked.indexOf(studentId);
  if (index > -1) {
    this.isBookmarked.splice(index, 1);
  } else {
    this.isBookmarked.push(studentId);
  }
  return this.save();
};

// Instance method to answer doubt
doubtSchema.methods.answerDoubt = function(answerText, answeredBy) {
  this.answer = {
    text: answerText,
    answeredBy: answeredBy,
    answeredAt: new Date()
  };
  this.status = 'answered';
  return this.save();
};

module.exports = mongoose.model('Doubt', doubtSchema);

