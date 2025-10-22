const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true
  },
  url: {
    type: String,
    required: [true, 'Meeting URL is required'],
    trim: true
  },
  meetingTime: {
    type: Date,
    required: [true, 'Meeting time is required']
  },
  duration: {
    type: Number, // Duration in minutes
    default: 60
  },
  description: {
    type: String,
    trim: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher ID is required']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required']
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject ID is required']
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', null],
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
meetingSchema.index({ teacherId: 1, meetingTime: -1 });
meetingSchema.index({ classId: 1, meetingTime: -1 });
meetingSchema.index({ schoolId: 1, meetingTime: -1 });
meetingSchema.index({ status: 1, meetingTime: 1 });

// Virtual for checking if meeting is upcoming
meetingSchema.virtual('isUpcoming').get(function() {
  return this.meetingTime > new Date() && this.status === 'scheduled';
});

// Virtual for checking if meeting is past
meetingSchema.virtual('isPast').get(function() {
  return this.meetingTime < new Date() && this.status !== 'cancelled';
});

module.exports = mongoose.model('Meeting', meetingSchema);

