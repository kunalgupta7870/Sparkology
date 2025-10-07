const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true,
    maxlength: [100, 'Subject name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    trim: true,
    maxlength: [20, 'Subject code cannot exceed 20 characters'],
    uppercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
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
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null
  },
  credits: {
    type: Number,
    default: 1,
    min: [1, 'Credits must be at least 1'],
    max: [10, 'Credits cannot exceed 10']
  },
  type: {
    type: String,
    enum: ['core', 'elective', 'practical'],
    default: 'core'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
subjectSchema.index({ schoolId: 1 });
subjectSchema.index({ teacherId: 1 });
subjectSchema.index({ classId: 1 });
subjectSchema.index({ name: 1, classId: 1, schoolId: 1 }, { unique: true });
subjectSchema.index({ code: 1, schoolId: 1 }, { unique: true });

// Static method to get subjects by school
subjectSchema.statics.getSubjectsBySchool = function(schoolId) {
  return this.find({ schoolId, status: 'active' }).populate('teacherId', 'name email');
};

// Static method to get subjects by teacher
subjectSchema.statics.getSubjectsByTeacher = function(teacherId) {
  return this.find({ teacherId, status: 'active' }).populate('classId', 'name section');
};

module.exports = mongoose.model('Subject', subjectSchema);

