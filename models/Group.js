const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  students: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  type: {
    type: String,
    enum: ['class', 'subject', 'custom', 'individual_chat'],
    default: 'custom'
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    allowStudentMessages: {
      type: Boolean,
      default: true
    },
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    notificationEnabled: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
groupSchema.index({ schoolId: 1, isActive: 1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ 'students.student': 1 });
groupSchema.index({ classId: 1 });
groupSchema.index({ subjectId: 1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.length + this.students.length;
});

// Virtual for teacher count
groupSchema.virtual('teacherCount').get(function() {
  return this.members.length;
});

// Virtual for student count
groupSchema.virtual('studentCount').get(function() {
  return this.students.length;
});

// Static method to get groups by school
groupSchema.statics.getGroupsBySchool = function(schoolId, isActive = true) {
  return this.find({ schoolId, isActive })
    .populate('createdBy', 'name email')
    .populate('members.user', 'name email role')
    .populate('students.student', 'name rollNumber')
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .sort({ createdAt: -1 });
};

// Static method to get groups by user
groupSchema.statics.getGroupsByUser = function(userId, schoolId) {
  return this.find({
    schoolId,
    isActive: true,
    $or: [
      { createdBy: userId },
      { 'members.user': userId }
    ]
  })
    .populate('createdBy', 'name email')
    .populate('members.user', 'name email role')
    .populate('students.student', 'name rollNumber')
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .sort({ createdAt: -1 });
};

// Static method to get groups by student
groupSchema.statics.getGroupsByStudent = function(studentId, schoolId) {
  return this.find({
    schoolId,
    isActive: true,
    'students.student': studentId
  })
    .populate('createdBy', 'name email')
    .populate('members.user', 'name email role')
    .populate('students.student', 'name rollNumber')
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .sort({ createdAt: -1 });
};

// Instance method to add member
groupSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (!existingMember) {
    this.members.push({
      user: userId,
      role: role,
      joinedAt: new Date()
    });
  }
  
  return this.save();
};

// Instance method to remove member
groupSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(member => 
    member.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Instance method to add student
groupSchema.methods.addStudent = function(studentId) {
  const existingStudent = this.students.find(student => 
    student.student.toString() === studentId.toString()
  );
  
  if (!existingStudent) {
    this.students.push({
      student: studentId,
      joinedAt: new Date()
    });
  }
  
  return this.save();
};

// Instance method to remove student
groupSchema.methods.removeStudent = function(studentId) {
  this.students = this.students.filter(student => 
    student.student.toString() !== studentId.toString()
  );
  
  return this.save();
};

// Instance method to check if user is member
groupSchema.methods.isMember = function(userId) {
  return this.members.some(member => 
    member.user.toString() === userId.toString()
  );
};

// Instance method to check if student is member
groupSchema.methods.isStudentMember = function(studentId) {
  return this.students.some(student => 
    student.student.toString() === studentId.toString()
  );
};

// Instance method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  const member = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  return member && member.role === 'admin';
};

module.exports = mongoose.model('Group', groupSchema);
