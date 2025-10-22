const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  // Student Information
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Student email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Student password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    trim: true,
    unique: true
  },
  admissionNumber: {
    type: String,
    required: [true, 'Admission number is required'],
    trim: true,
    unique: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required']
  },
  admissionDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'graduated', 'transferred'],
    default: 'active'
  },
  
  // Academic Information
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Contact Information
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true,
      default: 'India'
    }
  },
  phone: {
    type: String,
    trim: true
  },
  
  
  // Authentication & Security
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  
  // Additional Information
  avatar: {
    type: String,
    default: null
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    default: null
  },
  medicalInfo: {
    allergies: [String],
    medications: [String],
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    }
  },
  
  // Academic Records
  academicYear: {
    type: String,
    default: new Date().getFullYear().toString()
  },
  previousSchool: {
    type: String,
    trim: true
  },
  transferCertificate: {
    type: String,
    default: null
  },
  
  // Points System
  totalPoints: {
    type: Number,
    default: 0,
    min: [0, 'Total points cannot be negative']
  },
  pointsHistory: [{
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment'
    },
    pointsEarned: {
      type: Number,
      required: true
    },
    earnedAt: {
      type: Date,
      default: Date.now
    },
    assignmentTitle: String,
    subjectName: String,
    isLate: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
studentSchema.index({ email: 1 });
studentSchema.index({ rollNumber: 1 });
studentSchema.index({ admissionNumber: 1 });
studentSchema.index({ schoolId: 1 });
studentSchema.index({ classId: 1 });
studentSchema.index({ status: 1 });

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for age
studentSchema.virtual('age').get(function() {
  if (this.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  return null;
});

// Virtual for isLocked
studentSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash passwords
studentSchema.pre('save', async function(next) {
  try {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    // Hash student password
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check student password
studentSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};


// Instance method to increment login attempts
studentSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
studentSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Static method to find student by email
studentSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

// Static method to find student by roll number
studentSchema.statics.findByRollNumber = function(rollNumber) {
  return this.findOne({ rollNumber });
};

// Static method to get students by school
studentSchema.statics.getStudentsBySchool = function(schoolId) {
  return this.find({ schoolId }).populate('classId', 'name section');
};

// Static method to get students by class
studentSchema.statics.getStudentsByClass = function(classId) {
  return this.find({ classId, status: 'active' });
};

// Static method to get active students
studentSchema.statics.getActiveStudents = function(schoolId = null) {
  const query = { status: 'active' };
  if (schoolId) {
    query.schoolId = schoolId;
  }
  return this.find(query).populate('classId', 'name section');
};

// Instance method to add points
studentSchema.methods.addPoints = async function(assignmentId, pointsEarned, assignmentTitle, subjectName, isLate = false) {
  this.totalPoints += pointsEarned;
  
  this.pointsHistory.push({
    assignmentId,
    pointsEarned,
    assignmentTitle,
    subjectName,
    isLate
  });
  
  return this.save();
};

// Transform function to remove sensitive data
studentSchema.methods.toJSON = function() {
  const studentObject = this.toObject();
  delete studentObject.password;
  delete studentObject.loginAttempts;
  delete studentObject.lockUntil;
  return studentObject;
};

module.exports = mongoose.model('Student', studentSchema);

