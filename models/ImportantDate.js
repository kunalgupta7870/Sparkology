const mongoose = require('mongoose');

const importantDateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: {
      values: ['holiday', 'exam', 'event', 'meeting', 'deadline', 'other'],
      message: 'Event type must be one of: holiday, exam, event, meeting, deadline, other'
    }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  // If empty, applies to all classes
  applyToAllClasses: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Additional metadata
  startTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time format (HH:MM)']
  },
  endTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time format (HH:MM)']
  },
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  attachments: [{
    name: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Academic year
  academicYear: {
    type: String,
    default: '2024-2025'
  }
}, {
  timestamps: true
});

// Index for efficient queries
importantDateSchema.index({ schoolId: 1, date: 1, isActive: 1 });
importantDateSchema.index({ schoolId: 1, classes: 1, date: 1 });
importantDateSchema.index({ schoolId: 1, type: 1, date: 1 });

// Virtual for formatted date
importantDateSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Virtual for checking if event is today
importantDateSchema.virtual('isToday').get(function() {
  const today = new Date();
  const eventDate = new Date(this.date);
  return today.toDateString() === eventDate.toDateString();
});

// Virtual for checking if event is upcoming
importantDateSchema.virtual('isUpcoming').get(function() {
  const today = new Date();
  const eventDate = new Date(this.date);
  return eventDate > today;
});

// Method to check if event applies to a specific class
importantDateSchema.methods.appliesToClass = function(classId) {
  if (this.applyToAllClasses) {
    return true;
  }
  return this.classes.some(cls => cls.toString() === classId.toString());
};

// Method to get classes names (populated)
importantDateSchema.methods.getClassNames = async function() {
  if (this.applyToAllClasses) {
    return ['All Classes'];
  }
  
  await this.populate('classes', 'name section');
  return this.classes.map(cls => `${cls.name}${cls.section ? ` - ${cls.section}` : ''}`);
};

// Ensure virtual fields are serialized
importantDateSchema.set('toJSON', { virtuals: true });
importantDateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ImportantDate', importantDateSchema);
