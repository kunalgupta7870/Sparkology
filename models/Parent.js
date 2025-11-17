const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const parentSchema = new mongoose.Schema({
  // Parent Information
  name: {
    type: String,
    required: [true, 'Parent name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Parent email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Parent password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[\+]?[1-9][\d]{0,15}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  
  // Parent Type (father, mother, guardian)
  parentType: {
    type: String,
    enum: ['father', 'mother', 'guardian'],
    required: [true, 'Parent type is required']
  },
  
  // Relationship to Students (can have multiple children)
  studentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  
  // Deprecated: Keep for backward compatibility, but use studentIds array instead
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  },
  
  // School Information
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Personal Information
  dateOfBirth: {
    type: Date,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: null
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
  
  // Professional Information
  occupation: {
    type: String,
    trim: true
  },
  workplace: {
    type: String,
    trim: true
  },
  designation: {
    type: String,
    trim: true
  },
  
  // Emergency Contact
  emergencyContact: {
    name: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    }
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
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
// Email and phone are globally unique (across all schools)
parentSchema.index({ email: 1 }, { unique: true, sparse: true });
parentSchema.index({ phone: 1 }, { unique: true, sparse: true });
parentSchema.index({ studentIds: 1 });
parentSchema.index({ studentId: 1 }); // Keep for backward compatibility
parentSchema.index({ schoolId: 1 });
parentSchema.index({ parentType: 1 });
parentSchema.index({ isActive: 1 });

// Virtual for full name
parentSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for isLocked
parentSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to handle backward compatibility and hash password
parentSchema.pre('save', async function(next) {
  try {
    // Sync studentId with studentIds for backward compatibility
    if (this.studentId && !this.studentIds.includes(this.studentId)) {
      this.studentIds.push(this.studentId);
    }
    
    // If studentIds has items but studentId is not set, set it to the first one
    if (this.studentIds.length > 0 && !this.studentId) {
      this.studentId = this.studentIds[0];
    }
    
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
parentSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Instance method to increment login attempts
parentSchema.methods.incLoginAttempts = function() {
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
parentSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Static method to find parent by email
parentSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

// Static method to get parents by school
parentSchema.statics.getParentsBySchool = function(schoolId) {
  return this.find({ schoolId }).populate('studentId', 'name rollNumber classId');
};

// Static method to get parents by student (supports both old and new schema)
parentSchema.statics.getParentsByStudent = function(studentId) {
  return this.find({ 
    $or: [
      { studentId: studentId },
      { studentIds: studentId }
    ]
  });
};

// Static method to get active parents
parentSchema.statics.getActiveParents = function(schoolId = null) {
  const query = { isActive: true };
  if (schoolId) {
    query.schoolId = schoolId;
  }
  return this.find(query).populate('studentId', 'name rollNumber classId');
};

// Transform function to remove sensitive data
parentSchema.methods.toJSON = function() {
  const parentObject = this.toObject();
  delete parentObject.password;
  delete parentObject.loginAttempts;
  delete parentObject.lockUntil;
  return parentObject;
};

module.exports = mongoose.model('Parent', parentSchema);
