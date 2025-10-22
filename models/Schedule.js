const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: false,
    index: true
  },
  dayOfWeek: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    index: true
  },
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Start time must be in HH:MM format'
    }
  },
  endTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'End time must be in HH:MM format'
    }
  },
  room: {
    type: String,
    default: ''
  },
  academicYear: {
    type: String,
    required: true,
    default: '2024-2025'
  },
  semester: {
    type: String,
    enum: ['1', '2', 'Annual'],
    default: 'Annual'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for duration in minutes
scheduleSchema.virtual('duration').get(function() {
  const start = this.startTime.split(':');
  const end = this.endTime.split(':');
  const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
  const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
  return endMinutes - startMinutes;
});

// Virtual for display time
scheduleSchema.virtual('timeDisplay').get(function() {
  return `${this.startTime} - ${this.endTime}`;
});

// Indexes for better query performance
scheduleSchema.index({ schoolId: 1, dayOfWeek: 1, startTime: 1 });
scheduleSchema.index({ teacherId: 1, dayOfWeek: 1 });
scheduleSchema.index({ classId: 1, dayOfWeek: 1 });
scheduleSchema.index({ schoolId: 1, academicYear: 1 });
scheduleSchema.index({ schoolId: 1, teacherId: 1, classId: 1, dayOfWeek: 1, startTime: 1 }, { unique: true });

// Static method to get schedule by school
scheduleSchema.statics.getScheduleBySchool = function(schoolId, academicYear = '2024-2025') {
  return this.find({ 
    schoolId, 
    academicYear,
    status: 'active' 
  })
  .populate('teacherId', 'name email')
  .populate('classId', 'name section room')
  .populate('subjectId', 'name code')
  .sort({ dayOfWeek: 1, startTime: 1 });
};

// Static method to get schedule by teacher
scheduleSchema.statics.getScheduleByTeacher = function(teacherId, academicYear = '2024-2025') {
  return this.find({ 
    teacherId, 
    academicYear,
    status: 'active' 
  })
  .populate('classId', 'name section room')
  .populate('subjectId', 'name code')
  .sort({ dayOfWeek: 1, startTime: 1 });
};

// Static method to get schedule by class
scheduleSchema.statics.getScheduleByClass = function(classId, academicYear = '2024-2025') {
  return this.find({ 
    classId, 
    academicYear,
    status: 'active' 
  })
  .populate('teacherId', 'name email')
  .populate('subjectId', 'name code')
  .sort({ dayOfWeek: 1, startTime: 1 });
};

// Static method to get weekly schedule
scheduleSchema.statics.getWeeklySchedule = function(schoolId, academicYear = '2024-2025') {
  return this.find({ 
    schoolId, 
    academicYear,
    status: 'active' 
  })
  .populate('teacherId', 'name email')
  .populate('classId', 'name section room')
  .populate('subjectId', 'name code')
  .sort({ dayOfWeek: 1, startTime: 1 });
};

// Pre-save middleware to set dayOfWeek from date and validate time conflicts
scheduleSchema.pre('save', async function(next) {
  // Set dayOfWeek from date if not provided
  if (this.date && !this.dayOfWeek) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.dayOfWeek = days[this.date.getDay()];
  }
  
  // Generate a date from dayOfWeek if date is not provided (for recurring schedules)
  if (!this.date && this.dayOfWeek) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayIndex = days.indexOf(this.dayOfWeek);
    const today = new Date();
    const currentDayIndex = today.getDay();
    
    // Calculate days until target day (0-6)
    let daysUntilTarget = targetDayIndex - currentDayIndex;
    if (daysUntilTarget < 0) {
      daysUntilTarget += 7; // Next week
    }
    
    // Set the date to the next occurrence of the target day
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    targetDate.setHours(0, 0, 0, 0); // Reset time to midnight
    this.date = targetDate;
  }
  
  // Temporarily disable conflict validation for seeding
  // TODO: Re-enable after seeding is complete
  /*
  // Check for time conflicts with the same teacher
  const teacherConflict = await this.constructor.findOne({
    _id: { $ne: this._id },
    teacherId: this.teacherId,
    date: this.date,
    academicYear: this.academicYear,
    status: 'active',
    $or: [
      {
        startTime: { $lt: this.endTime },
        endTime: { $gt: this.startTime }
      }
    ]
  });

  if (teacherConflict) {
    return next(new Error('Teacher has a conflicting schedule at this time'));
  }
  */

  /*
  // Check for time conflicts with the same class
  const classConflict = await this.constructor.findOne({
    _id: { $ne: this._id },
    classId: this.classId,
    date: this.date,
    academicYear: this.academicYear,
    status: 'active',
    $or: [
      {
        startTime: { $lt: this.endTime },
        endTime: { $gt: this.startTime }
      }
    ]
  });

  if (classConflict) {
    return next(new Error('Class has a conflicting schedule at this time'));
  }
  */

  next();
});

module.exports = mongoose.model('Schedule', scheduleSchema);
