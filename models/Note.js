const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Note title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  content: {
    type: String,
    required: [true, 'Note content is required'],
    trim: true,
  },
  attachments: [{
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
noteSchema.index({ schoolId: 1, classId: 1, subjectId: 1, isActive: 1 });
noteSchema.index({ teacherId: 1, createdAt: -1 });

// Static method to get notes for a specific class and subject
noteSchema.statics.getNotesForClassSubject = function(classId, subjectId) {
  return this.find({
    classId,
    subjectId,
    isActive: true
  })
  .populate('teacherId', 'name email')
  .populate('subjectId', 'name')
  .populate('classId', 'name section')
  .sort({ createdAt: -1 });
};

// Static method to get notes for a teacher
noteSchema.statics.getNotesForTeacher = function(teacherId) {
  return this.find({
    teacherId,
    isActive: true
  })
  .populate('classId', 'name section')
  .populate('subjectId', 'name')
  .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Note', noteSchema);
