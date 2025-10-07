const mongoose = require('mongoose');

const teacherAttendanceSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day', 'excused'],
    required: true,
    default: 'absent'
  },
  checkInTime: {
    type: Date,
    default: null
  },
  checkOutTime: {
    type: Date,
    default: null
  },
  remarks: {
    type: String,
    maxlength: 500
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  academicYear: {
    type: String,
    required: true,
    default: '2024-2025'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
teacherAttendanceSchema.index({ schoolId: 1, teacherId: 1, date: 1 }, { unique: true });
teacherAttendanceSchema.index({ schoolId: 1, date: 1 });
teacherAttendanceSchema.index({ teacherId: 1, academicYear: 1, status: 1 });

// Static method to get teacher attendance by date range
teacherAttendanceSchema.statics.getTeacherAttendanceByDateRange = function(schoolId, startDate, endDate, academicYear = '2024-2025') {
  return this.find({
    schoolId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    academicYear,
    isActive: true
  })
  .populate('teacherId', 'name email subjects')
  .populate('markedBy', 'name email')
  .sort({ date: -1, 'teacherId.name': 1 });
};

// Static method to get teacher attendance statistics
teacherAttendanceSchema.statics.getTeacherAttendanceStats = function(teacherId, academicYear = '2024-2025') {
  return this.aggregate([
    {
      $match: {
        teacherId: new mongoose.Types.ObjectId(teacherId),
        academicYear,
        isActive: true
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Static method to get all teachers attendance for a specific date
teacherAttendanceSchema.statics.getTeachersAttendanceByDate = function(schoolId, date, academicYear = '2024-2025') {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    schoolId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    academicYear,
    isActive: true
  })
  .populate('teacherId', 'name email subjects')
  .populate('markedBy', 'name email')
  .sort({ 'teacherId.name': 1 });
};

// Static method to get school-wide teacher attendance statistics
teacherAttendanceSchema.statics.getSchoolTeacherAttendanceStats = function(schoolId, academicYear = '2024-2025') {
  return this.aggregate([
    {
      $match: {
        schoolId: new mongoose.Types.ObjectId(schoolId),
        academicYear,
        isActive: true
      }
    },
    {
      $group: {
        _id: {
          teacherId: '$teacherId',
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.teacherId',
        totalDays: { $sum: '$count' },
        present: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0]
          }
        },
        absent: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0]
          }
        },
        late: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'late'] }, '$count', 0]
          }
        },
        halfDay: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'half-day'] }, '$count', 0]
          }
        },
        excused: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'excused'] }, '$count', 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'teacher'
      }
    },
    {
      $unwind: '$teacher'
    },
    {
      $addFields: {
        attendancePercentage: {
          $multiply: [
            { $divide: ['$present', '$totalDays'] },
            100
          ]
        }
      }
    },
    {
      $project: {
        teacherId: '$_id',
        teacherName: '$teacher.name',
        teacherEmail: '$teacher.email',
        totalDays: 1,
        present: 1,
        absent: 1,
        late: 1,
        halfDay: 1,
        excused: 1,
        attendancePercentage: { $round: ['$attendancePercentage', 2] }
      }
    },
    {
      $sort: { teacherName: 1 }
    }
  ]);
};

// Pre-save middleware to validate teacher attendance data
teacherAttendanceSchema.pre('save', async function(next) {
  // Check if attendance already exists for this teacher on this date
  const existingAttendance = await this.constructor.findOne({
    _id: { $ne: this._id },
    schoolId: this.schoolId,
    teacherId: this.teacherId,
    date: {
      $gte: new Date(this.date.setHours(0, 0, 0, 0)),
      $lte: new Date(this.date.setHours(23, 59, 59, 999))
    },
    isActive: true
  });

  if (existingAttendance) {
    return next(new Error('Attendance already marked for this teacher on this date'));
  }

  next();
});

module.exports = mongoose.model('TeacherAttendance', teacherAttendanceSchema);
