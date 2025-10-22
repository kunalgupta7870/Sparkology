const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  // Route Information
  name: {
    type: String,
    required: [true, 'Route name is required'],
    trim: true,
    maxlength: [100, 'Route name cannot exceed 100 characters']
  },
  routeNumber: {
    type: String,
    required: [true, 'Route number is required'],
    trim: true,
    unique: true
  },
  startPoint: {
    type: String,
    required: [true, 'Start point is required'],
    trim: true
  },
  endPoint: {
    type: String,
    required: [true, 'End point is required'],
    trim: true
  },
  distance: {
    type: String,
    required: [true, 'Distance is required'],
    trim: true
  },
  estimatedTime: {
    type: String,
    trim: true
  },
  
  // Stops along the route
  stops: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    arrivalTime: {
      type: String,
      required: true
    },
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    }
  }],
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  
  // Additional Information
  description: {
    type: String,
    trim: true
  },
  fare: {
    type: Number,
    min: [0, 'Fare cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
routeSchema.index({ schoolId: 1 });
routeSchema.index({ routeNumber: 1 });
routeSchema.index({ status: 1 });

// Virtual to get student count
routeSchema.virtual('studentCount', {
  ref: 'StudentTransport',
  localField: '_id',
  foreignField: 'routeId',
  count: true
});

// Static method to get routes by school
routeSchema.statics.getRoutesBySchool = function(schoolId) {
  return this.find({ schoolId }).populate('studentCount');
};

// Static method to get active routes
routeSchema.statics.getActiveRoutes = function(schoolId) {
  return this.find({ schoolId, status: 'active' });
};

module.exports = mongoose.model('Route', routeSchema);

