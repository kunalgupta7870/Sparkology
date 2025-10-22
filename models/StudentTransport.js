const mongoose = require('mongoose');

const studentTransportSchema = new mongoose.Schema({
  // Student Information
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required']
  },
  
  // Transport Assignment
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: [true, 'Route ID is required']
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null
  },
  
  // Pickup Information
  pickupPoint: {
    type: String,
    required: [true, 'Pickup point is required'],
    trim: true
  },
  pickupTime: {
    type: String,
    required: [true, 'Pickup time is required'],
    trim: true
  },
  dropTime: {
    type: String,
    trim: true
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Fee Information
  monthlyFee: {
    type: Number,
    min: [0, 'Fee cannot be negative'],
    default: 0
  },
  feeStatus: {
    type: String,
    enum: ['paid', 'pending', 'overdue'],
    default: 'pending'
  },
  lastPaymentDate: {
    type: Date
  },
  
  // Additional Information
  parentContact: {
    name: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  specialInstructions: {
    type: String,
    trim: true
  },
  
  // Transport Type
  transportType: {
    type: String,
    enum: ['both-way', 'pickup-only', 'drop-only'],
    default: 'both-way'
  },
  
  // Start and End Dates
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  
  // Attendance & Usage
  attendanceHistory: [{
    date: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'on-leave'],
      required: true
    },
    pickupTime: {
      type: String
    },
    dropTime: {
      type: String
    },
    remarks: {
      type: String
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
studentTransportSchema.index({ studentId: 1 });
studentTransportSchema.index({ routeId: 1 });
studentTransportSchema.index({ vehicleId: 1 });
studentTransportSchema.index({ schoolId: 1 });
studentTransportSchema.index({ status: 1 });

// Compound indexes for complex queries
studentTransportSchema.index({ schoolId: 1, status: 1 });
studentTransportSchema.index({ routeId: 1, status: 1 });

// Static method to get student transports by school
studentTransportSchema.statics.getTransportsBySchool = function(schoolId) {
  return this.find({ schoolId })
    .populate('studentId', 'name rollNumber classId')
    .populate('routeId', 'name routeNumber startPoint endPoint')
    .populate('vehicleId', 'vehicleNumber vehicleType');
};

// Static method to get students by route
studentTransportSchema.statics.getStudentsByRoute = function(routeId) {
  return this.find({ routeId, status: 'active' })
    .populate('studentId', 'name rollNumber classId phone');
};

// Static method to get active transports
studentTransportSchema.statics.getActiveTransports = function(schoolId) {
  return this.find({ schoolId, status: 'active' })
    .populate('studentId', 'name rollNumber classId')
    .populate('routeId', 'name routeNumber')
    .populate('vehicleId', 'vehicleNumber');
};

// Method to add attendance record
studentTransportSchema.methods.addAttendance = function(date, status, pickupTime, dropTime, remarks) {
  this.attendanceHistory.push({
    date,
    status,
    pickupTime,
    dropTime,
    remarks
  });
  return this.save();
};

// Check if student transport is active
studentTransportSchema.methods.isActive = function() {
  if (this.endDate) {
    return this.status === 'active' && new Date() <= this.endDate;
  }
  return this.status === 'active';
};

module.exports = mongoose.model('StudentTransport', studentTransportSchema);

