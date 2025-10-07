const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Assignment title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Assignment description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject is required']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher is required']
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School is required']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  dueTime: {
    type: String, // Format: "HH:MM" (24-hour format)
    required: false
  },
  attachments: [{
    name: String,
    url: String,
    type: String, // 'pdf', 'image', 'document', etc.
    size: Number
  }],
  totalMarks: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  submissions: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    submittedAt: Date,
    attachments: [{
      name: String,
      url: String,
      type: String
    }],
    marks: Number,
    feedback: String,
    status: {
      type: String,
      enum: ['submitted', 'late', 'graded', 'pending'],
      default: 'pending'
    }
  }],
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
assignmentSchema.index({ schoolId: 1, classId: 1 });
assignmentSchema.index({ teacherId: 1, dueDate: 1 });
assignmentSchema.index({ classId: 1, status: 1 });
assignmentSchema.index({ dueDate: 1, status: 1 });

// Virtual for submission count
assignmentSchema.virtual('submissionCount').get(function() {
  return this.submissions.filter(s => s.status !== 'pending').length;
});

// Virtual for total students (this would need to be populated separately)
assignmentSchema.virtual('totalStudents', {
  ref: 'Student',
  localField: 'classId',
  foreignField: 'classId',
  count: true
});

// Static method to get assignments by teacher
assignmentSchema.statics.getAssignmentsByTeacher = function(teacherId, options = {}) {
  const { status, startDate, endDate } = options;
  const query = { teacherId };
  
  if (status) query.status = status;
  if (startDate || endDate) {
    query.dueDate = {};
    if (startDate) query.dueDate.$gte = new Date(startDate);
    if (endDate) query.dueDate.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('schoolId', 'name')
    .sort({ dueDate: -1 });
};

// Static method to get assignments by class
assignmentSchema.statics.getAssignmentsByClass = function(classId, options = {}) {
  const { status, startDate, endDate } = options;
  const query = { classId };
  
  if (status) query.status = status;
  if (startDate || endDate) {
    query.dueDate = {};
    if (startDate) query.dueDate.$gte = new Date(startDate);
    if (endDate) query.dueDate.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('teacherId', 'name email')
    .populate('subjectId', 'name code')
    .sort({ dueDate: -1 });
};

// Instance method to add submission
assignmentSchema.methods.addSubmission = async function(studentId, attachments = [], marks = null) {
  const submission = {
    studentId,
    submittedAt: new Date(),
    attachments,
    marks,
    status: 'submitted'
  };
  
  // Check if student already submitted
  const existingIndex = this.submissions.findIndex(
    s => s.studentId.toString() === studentId.toString()
  );
  
  if (existingIndex !== -1) {
    this.submissions[existingIndex] = submission;
  } else {
    this.submissions.push(submission);
  }
  
  return this.save();
};

// Instance method to grade submission
assignmentSchema.methods.gradeSubmission = async function(studentId, marks, feedback) {
  const submission = this.submissions.find(
    s => s.studentId.toString() === studentId.toString()
  );
  
  if (!submission) {
    throw new Error('Submission not found');
  }
  
  submission.marks = marks;
  submission.feedback = feedback;
  submission.status = 'graded';
  
  return this.save();
};

module.exports = mongoose.model('Assignment', assignmentSchema);

