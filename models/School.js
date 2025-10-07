const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'School name is required'],
    trim: true,
    maxlength: [200, 'School name cannot exceed 200 characters']
  },
  code: {
    type: String,
    required: [true, 'School code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [20, 'School code cannot exceed 20 characters']
  },
  address: {
    type: String,
    required: [true, 'School address is required'],
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  contact: {
    type: String,
    required: [true, 'Contact information is required'],
    trim: true,
    maxlength: [100, 'Contact information cannot exceed 100 characters']
  },
  logo: {
    type: String,
    default: null,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    required: true
  },
  plan: {
    type: String,
    default: 'basic',
    trim: true,
    maxlength: [50, 'Plan name cannot exceed 50 characters']
  },
  students: {
    type: Number,
    default: 0,
    min: [0, 'Student count cannot be negative']
  },
  teachers: {
    type: Number,
    default: 0,
    min: [0, 'Teacher count cannot be negative']
  },
  establishedDate: {
    type: Date,
    default: Date.now
  },
  website: {
    type: String,
    default: null,
    trim: true
  },
  email: {
    type: String,
    default: null,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    default: null,
    trim: true
  },
  principal: {
    name: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  features: {
    studentManagement: {
      type: Boolean,
      default: true
    },
    teacherManagement: {
      type: Boolean,
      default: true
    },
    attendanceTracking: {
      type: Boolean,
      default: true
    },
    feeManagement: {
      type: Boolean,
      default: true
    },
    examManagement: {
      type: Boolean,
      default: true
    },
    reportGeneration: {
      type: Boolean,
      default: true
    },
    messaging: {
      type: Boolean,
      default: true
    },
    liveClasses: {
      type: Boolean,
      default: false
    }
  },
  subscription: {
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    },
    isActive: {
      type: Boolean,
      default: true
    },
    maxStudents: {
      type: Number,
      default: 1000
    },
    maxTeachers: {
      type: Number,
      default: 100
    }
  },
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    academicYear: {
      type: String,
      default: new Date().getFullYear().toString()
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
schoolSchema.index({ name: 1 });
schoolSchema.index({ code: 1 });
schoolSchema.index({ status: 1 });
schoolSchema.index({ 'subscription.endDate': 1 });

// Virtual for subscription status
schoolSchema.virtual('subscriptionStatus').get(function() {
  if (!this.subscription.isActive) return 'inactive';
  if (this.subscription.endDate < new Date()) return 'expired';
  return 'active';
});

// Virtual for days until subscription expires
schoolSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const expiry = new Date(this.subscription.endDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Pre-save middleware to validate subscription
schoolSchema.pre('save', function(next) {
  // Check if subscription is expired
  if (this.subscription.endDate < new Date()) {
    this.subscription.isActive = false;
  }
  next();
});

// Static method to get active schools
schoolSchema.statics.getActiveSchools = function() {
  return this.find({ 
    status: 'active',
    'subscription.isActive': true,
    'subscription.endDate': { $gt: new Date() }
  });
};

// Static method to get schools by status
schoolSchema.statics.getSchoolsByStatus = function(status) {
  return this.find({ status });
};

// Static method to get schools with expiring subscriptions
schoolSchema.statics.getExpiringSchools = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    'subscription.endDate': { $lte: futureDate, $gt: new Date() },
    'subscription.isActive': true
  });
};

// Instance method to check if school can add more students
schoolSchema.methods.canAddStudents = function(count = 1) {
  return (this.students + count) <= this.subscription.maxStudents;
};

// Instance method to check if school can add more teachers
schoolSchema.methods.canAddTeachers = function(count = 1) {
  return (this.teachers + count) <= this.subscription.maxTeachers;
};

// Instance method to update student count
schoolSchema.methods.updateStudentCount = function(count) {
  if (this.canAddStudents(count)) {
    this.students += count;
    return this.save();
  }
  throw new Error('Cannot add more students. Subscription limit reached.');
};

// Instance method to update teacher count
schoolSchema.methods.updateTeacherCount = function(count) {
  if (this.canAddTeachers(count)) {
    this.teachers += count;
    return this.save();
  }
  throw new Error('Cannot add more teachers. Subscription limit reached.');
};

module.exports = mongoose.model('School', schoolSchema);
