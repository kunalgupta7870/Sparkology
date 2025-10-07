const TeacherAttendance = require('../models/TeacherAttendance');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Mark teacher attendance
// @route   POST /api/teacher-attendance
// @access  Private (School Admin)
const markTeacherAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { teacherId, date, status, checkInTime, checkOutTime, remarks } = req.body;
    const schoolId = req.user.schoolId;
    const markedBy = req.user.id;

    // Verify the teacher exists and belongs to the school
    const teacher = await User.findOne({ 
      _id: teacherId, 
      schoolId, 
      role: 'teacher',
      isActive: true 
    });
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found or not active'
      });
    }

    // Check if attendance already exists for this teacher on this date
    const existingAttendance = await TeacherAttendance.findOne({
      schoolId,
      teacherId,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999)
      },
      isActive: true
    });

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.status = status;
      existingAttendance.checkInTime = checkInTime ? new Date(checkInTime) : null;
      existingAttendance.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
      existingAttendance.remarks = remarks;
      existingAttendance.markedAt = new Date();
      await existingAttendance.save();

      return res.status(200).json({
        success: true,
        message: 'Teacher attendance updated successfully',
        data: existingAttendance
      });
    } else {
      // Create new attendance record
      const attendance = await TeacherAttendance.create({
        schoolId,
        teacherId,
        date: new Date(date),
        status,
        checkInTime: checkInTime ? new Date(checkInTime) : null,
        checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
        remarks,
        markedBy,
        academicYear: '2024-2025'
      });

      return res.status(201).json({
        success: true,
        message: 'Teacher attendance marked successfully',
        data: attendance
      });
    }
  } catch (error) {
    console.error('Mark teacher attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking teacher attendance'
    });
  }
};

// @desc    Mark bulk teacher attendance
// @route   POST /api/teacher-attendance/bulk
// @access  Private (School Admin)
const markBulkTeacherAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { attendanceRecords } = req.body;
    const schoolId = req.user.schoolId;
    const markedBy = req.user.id;

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Attendance records array is required'
      });
    }

    const results = [];
    const failedRecords = [];

    for (const record of attendanceRecords) {
      try {
        const { teacherId, date, status, checkInTime, checkOutTime, remarks } = record;

        // Verify the teacher exists and belongs to the school
        const teacher = await User.findOne({ 
          _id: teacherId, 
          schoolId, 
          role: 'teacher',
          isActive: true 
        });
        
        if (!teacher) {
          failedRecords.push({ teacherId, error: 'Teacher not found or not active' });
          continue;
        }

        // Check if attendance already exists for this teacher on this date
        const existingAttendance = await TeacherAttendance.findOne({
          schoolId,
          teacherId,
          date: {
            $gte: new Date(date).setHours(0, 0, 0, 0),
            $lte: new Date(date).setHours(23, 59, 59, 999)
          },
          isActive: true
        });

        if (existingAttendance) {
          // Update existing attendance
          existingAttendance.status = status;
          existingAttendance.checkInTime = checkInTime ? new Date(checkInTime) : null;
          existingAttendance.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
          existingAttendance.remarks = remarks;
          existingAttendance.markedAt = new Date();
          await existingAttendance.save();
          results.push(existingAttendance);
        } else {
          // Create new attendance record
          const attendance = await TeacherAttendance.create({
            schoolId,
            teacherId,
            date: new Date(date),
            status,
            checkInTime: checkInTime ? new Date(checkInTime) : null,
            checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
            remarks,
            markedBy,
            academicYear: '2024-2025'
          });
          results.push(attendance);
        }
      } catch (recordError) {
        failedRecords.push({ 
          teacherId: record.teacherId, 
          error: recordError.message 
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Attendance marked for ${results.length} teachers`,
      data: {
        successful: results,
        failed: failedRecords
      }
    });
  } catch (error) {
    console.error('Bulk teacher attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking bulk teacher attendance'
    });
  }
};

// @desc    Get teacher attendance for a specific date
// @route   GET /api/teacher-attendance
// @access  Private (School Admin)
const getTeacherAttendance = async (req, res) => {
  try {
    const { date, academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required'
      });
    }

    const attendance = await TeacherAttendance.getTeachersAttendanceByDate(
      schoolId, 
      new Date(date), 
      academicYear
    );

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    console.error('Get teacher attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching teacher attendance'
    });
  }
};

// @desc    Get teacher attendance statistics
// @route   GET /api/teacher-attendance/stats
// @access  Private (School Admin)
const getTeacherAttendanceStats = async (req, res) => {
  try {
    const { academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    const stats = await TeacherAttendance.getSchoolTeacherAttendanceStats(schoolId, academicYear);

    // Calculate overall statistics
    const totalTeachers = stats.length;
    const totalDays = stats.reduce((sum, stat) => sum + stat.totalDays, 0);
    const totalPresent = stats.reduce((sum, stat) => sum + stat.present, 0);
    const totalAbsent = stats.reduce((sum, stat) => sum + stat.absent, 0);
    const totalLate = stats.reduce((sum, stat) => sum + stat.late, 0);
    const totalHalfDay = stats.reduce((sum, stat) => sum + stat.halfDay, 0);
    const totalExcused = stats.reduce((sum, stat) => sum + stat.excused, 0);
    
    const overallAttendancePercentage = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;
    const averageAttendancePercentage = totalTeachers > 0 
      ? stats.reduce((sum, stat) => sum + stat.attendancePercentage, 0) / totalTeachers 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalTeachers,
          totalDays,
          totalPresent,
          totalAbsent,
          totalLate,
          totalHalfDay,
          totalExcused,
          overallAttendancePercentage: Math.round(overallAttendancePercentage * 100) / 100,
          averageAttendancePercentage: Math.round(averageAttendancePercentage * 100) / 100
        },
        teacherStats: stats
      }
    });
  } catch (error) {
    console.error('Get teacher attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching teacher attendance statistics'
    });
  }
};

// @desc    Get teacher attendance by date range
// @route   GET /api/teacher-attendance/range
// @access  Private (School Admin)
const getTeacherAttendanceByRange = async (req, res) => {
  try {
    const { startDate, endDate, academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const attendance = await TeacherAttendance.getTeacherAttendanceByDateRange(
      schoolId,
      new Date(startDate),
      new Date(endDate),
      academicYear
    );

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    console.error('Get teacher attendance by range error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching teacher attendance by range'
    });
  }
};

// @desc    Update teacher attendance record
// @route   PUT /api/teacher-attendance/:id
// @access  Private (School Admin)
const updateTeacherAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, checkInTime, checkOutTime, remarks } = req.body;
    const schoolId = req.user.schoolId;

    const attendance = await TeacherAttendance.findOne({ _id: id, schoolId, isActive: true });
    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Teacher attendance record not found'
      });
    }

    attendance.status = status;
    attendance.checkInTime = checkInTime ? new Date(checkInTime) : null;
    attendance.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
    attendance.remarks = remarks;
    attendance.markedAt = new Date();
    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Teacher attendance updated successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Update teacher attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating teacher attendance'
    });
  }
};

// @desc    Delete teacher attendance record
// @route   DELETE /api/teacher-attendance/:id
// @access  Private (School Admin)
const deleteTeacherAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const attendance = await TeacherAttendance.findOne({ _id: id, schoolId, isActive: true });
    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Teacher attendance record not found'
      });
    }

    attendance.isActive = false;
    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Teacher attendance record deleted successfully'
    });
  } catch (error) {
    console.error('Delete teacher attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting teacher attendance'
    });
  }
};

module.exports = {
  markTeacherAttendance,
  markBulkTeacherAttendance,
  getTeacherAttendance,
  getTeacherAttendanceStats,
  getTeacherAttendanceByRange,
  updateTeacherAttendance,
  deleteTeacherAttendance
};
