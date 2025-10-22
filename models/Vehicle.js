const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  // Vehicle Information
  vehicleNumber: {
    type: String,
    required: [true, 'Vehicle number is required'],
    trim: true,
    unique: true,
    uppercase: true
  },
  vehicleType: {
    type: String,
    required: [true, 'Vehicle type is required'],
    enum: ['School Bus', 'Mini Bus', 'Van'],
    default: 'School Bus'
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    trim: true,
    unique: true,
    uppercase: true
  },
  
  // Vehicle Details
  manufacturer: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  year: {
    type: Number,
    min: [1900, 'Invalid year']
  },
  color: {
    type: String,
    trim: true
  },
  
  // Assignment
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Status & Maintenance
  status: {
    type: String,
    enum: ['active', 'maintenance', 'inactive'],
    default: 'active'
  },
  lastMaintenanceDate: {
    type: Date
  },
  nextMaintenanceDate: {
    type: Date
  },
  maintenanceHistory: [{
    date: {
      type: Date,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    cost: {
      type: Number,
      min: 0
    },
    performedBy: {
      type: String
    }
  }],
  
  // Insurance & Documents
  insuranceExpiryDate: {
    type: Date
  },
  fitnessExpiryDate: {
    type: Date
  },
  pollutionExpiryDate: {
    type: Date
  },
  
  // Additional Information
  fuelType: {
    type: String,
    enum: ['Petrol', 'Diesel', 'CNG', 'Electric'],
    default: 'Diesel'
  },
  averageMileage: {
    type: Number,
    min: [0, 'Mileage cannot be negative']
  },
  currentMileage: {
    type: Number,
    min: [0, 'Mileage cannot be negative'],
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
vehicleSchema.index({ schoolId: 1 });
vehicleSchema.index({ vehicleNumber: 1 });
vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ routeId: 1 });
vehicleSchema.index({ driverId: 1 });

// Static method to get vehicles by school
vehicleSchema.statics.getVehiclesBySchool = function(schoolId) {
  return this.find({ schoolId })
    .populate('routeId', 'name routeNumber')
    .populate('driverId', 'name licenseNumber phone');
};

// Static method to get active vehicles
vehicleSchema.statics.getActiveVehicles = function(schoolId) {
  return this.find({ schoolId, status: 'active' });
};

// Static method to get available vehicles (not assigned to any route)
vehicleSchema.statics.getAvailableVehicles = function(schoolId) {
  return this.find({ schoolId, status: 'active', routeId: null });
};

// Check if maintenance is due
vehicleSchema.methods.isMaintenanceDue = function() {
  if (this.nextMaintenanceDate) {
    return new Date() >= this.nextMaintenanceDate;
  }
  return false;
};

module.exports = mongoose.model('Vehicle', vehicleSchema);

