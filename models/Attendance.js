const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
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
    enum: ['present', 'absent', 'late', 'excused'],
    required: true,
    default: 'absent'
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
attendanceSchema.index({ schoolId: 1, studentId: 1, date: 1, subjectId: 1 }, { unique: true });
attendanceSchema.index({ schoolId: 1, classId: 1, date: 1, subjectId: 1 });
attendanceSchema.index({ schoolId: 1, teacherId: 1, date: 1 });
attendanceSchema.index({ studentId: 1, academicYear: 1, status: 1 });

// Static method to get attendance by student
attendanceSchema.statics.getAttendanceByStudent = function(studentId, academicYear = '2024-2025') {
  return this.find({
    studentId,
    academicYear,
    isActive: true
  })
  .populate('classId', 'name section')
  .populate('subjectId', 'name code')
  .populate('teacherId', 'name email')
  .populate('markedBy', 'name email')
  .sort({ date: -1 });
};

// Static method to get attendance by class and date
attendanceSchema.statics.getAttendanceByClassAndDate = function(classId, subjectId, date, academicYear = '2024-2025') {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    classId,
    subjectId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    academicYear,
    isActive: true
  })
  .populate({
    path: 'studentId',
    select: 'name rollNumber',
    options: { strictPopulate: false }
  })
  .populate({
    path: 'teacherId',
    select: 'name email',
    options: { strictPopulate: false }
  })
  .sort({ 'studentId.rollNumber': 1 });
};

// Static method to get attendance statistics for a student
attendanceSchema.statics.getStudentAttendanceStats = function(studentId, academicYear = '2024-2025') {
  return this.aggregate([
    {
      $match: {
        studentId: new mongoose.Types.ObjectId(studentId),
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

// Static method to get attendance statistics for a class
attendanceSchema.statics.getClassAttendanceStats = function(classId, academicYear = '2024-2025') {
  return this.aggregate([
    {
      $match: {
        classId: new mongoose.Types.ObjectId(classId),
        academicYear,
        isActive: true
      }
    },
    {
      $group: {
        _id: {
          studentId: '$studentId',
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.studentId',
        totalClasses: { $sum: '$count' },
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
        excused: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'excused'] }, '$count', 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: '_id',
        as: 'student'
      }
    },
    {
      $unwind: '$student'
    },
    {
      $addFields: {
        attendancePercentage: {
          $multiply: [
            { $divide: ['$present', '$totalClasses'] },
            100
          ]
        }
      }
    },
    {
      $project: {
        studentId: '$_id',
        studentName: '$student.name',
        rollNumber: '$student.rollNumber',
        totalClasses: 1,
        present: 1,
        absent: 1,
        late: 1,
        excused: 1,
        attendancePercentage: { $round: ['$attendancePercentage', 2] }
      }
    },
    {
      $sort: { 'student.rollNumber': 1 }
    }
  ]);
};

// Static method to get attendance by date range
attendanceSchema.statics.getAttendanceByDateRange = function(schoolId, startDate, endDate, academicYear = '2024-2025') {
  return this.find({
    schoolId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    academicYear,
    isActive: true
  })
  .populate('studentId', 'name rollNumber')
  .populate('classId', 'name section')
  .populate('subjectId', 'name code')
  .populate('teacherId', 'name email')
  .sort({ date: -1, 'studentId.rollNumber': 1 });
};

// Pre-save middleware to validate attendance data
attendanceSchema.pre('save', async function(next) {
  // Check if attendance already exists for this student, class, subject, and date
  const existingAttendance = await this.constructor.findOne({
    _id: { $ne: this._id },
    schoolId: this.schoolId,
    studentId: this.studentId,
    classId: this.classId,
    subjectId: this.subjectId,
    date: {
      $gte: new Date(this.date.setHours(0, 0, 0, 0)),
      $lte: new Date(this.date.setHours(23, 59, 59, 999))
    },
    isActive: true
  });

  if (existingAttendance) {
    return next(new Error('Attendance already marked for this student on this date'));
  }

  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
