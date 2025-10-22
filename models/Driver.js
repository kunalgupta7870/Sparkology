const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  // Driver Information
  name: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  
  // License Information
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    trim: true,
    unique: true,
    uppercase: true
  },
  licenseType: {
    type: String,
    required: [true, 'License type is required'],
    enum: ['Heavy Vehicle', 'Light Vehicle', 'Both'],
    default: 'Heavy Vehicle'
  },
  licenseExpiryDate: {
    type: Date,
    required: [true, 'License expiry date is required']
  },
  
  // Assignment
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Personal Information
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
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
  
  // Employment Information
  dateOfJoining: {
    type: Date,
    default: Date.now
  },
  employeeId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  salary: {
    type: Number,
    min: [0, 'Salary cannot be negative']
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'on-leave', 'inactive'],
    default: 'active'
  },
  
  // Additional Information
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
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
  
  // Experience & Training
  experienceYears: {
    type: Number,
    min: [0, 'Experience cannot be negative'],
    default: 0
  },
  trainingCertificates: [{
    name: {
      type: String,
      required: true
    },
    issueDate: {
      type: Date
    },
    expiryDate: {
      type: Date
    },
    documentUrl: {
      type: String
    }
  }],
  
  // Performance & Disciplinary
  performanceRating: {
    type: Number,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5'],
    default: 0
  },
  disciplinaryRecords: [{
    date: {
      type: Date,
      required: true
    },
    incident: {
      type: String,
      required: true
    },
    action: {
      type: String
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
driverSchema.index({ schoolId: 1 });
driverSchema.index({ licenseNumber: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ vehicleId: 1 });
driverSchema.index({ routeId: 1 });

// Virtual for age
driverSchema.virtual('age').get(function() {
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

// Check if license is expired
driverSchema.methods.isLicenseExpired = function() {
  return new Date() > this.licenseExpiryDate;
};

// Static method to get drivers by school
driverSchema.statics.getDriversBySchool = function(schoolId) {
  return this.find({ schoolId })
    .populate('vehicleId', 'vehicleNumber vehicleType')
    .populate('routeId', 'name routeNumber');
};

// Static method to get active drivers
driverSchema.statics.getActiveDrivers = function(schoolId) {
  return this.find({ schoolId, status: 'active' });
};

// Static method to get available drivers (not assigned to any vehicle)
driverSchema.statics.getAvailableDrivers = function(schoolId) {
  return this.find({ schoolId, status: 'active', vehicleId: null });
};

module.exports = mongoose.model('Driver', driverSchema);

