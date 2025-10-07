const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Mark attendance for students
// @route   POST /api/attendance
// @access  Private (Teacher)
const markAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { studentId, classId, subjectId, date, status, remarks } = req.body;
    const schoolId = req.user.schoolId;
    const teacherId = req.user.id;

    // Verify the teacher is authorized to mark attendance for this class
    const classData = await Class.findOne({ _id: classId, schoolId });
    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Verify the subject exists and teacher is assigned to it
    const subject = await Subject.findOne({ _id: subjectId, schoolId });
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    // Verify the student is in the class
    const student = await Student.findOne({ _id: studentId, classId, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found in this class'
      });
    }

    // Check if attendance already exists for this student on this date
    const existingAttendance = await Attendance.findOne({
      schoolId,
      studentId,
      classId,
      subjectId,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999)
      },
      isActive: true
    });

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.status = status;
      existingAttendance.remarks = remarks;
      existingAttendance.markedAt = new Date();
      await existingAttendance.save();

      return res.status(200).json({
        success: true,
        message: 'Attendance updated successfully',
        data: existingAttendance
      });
    } else {
      // Create new attendance record
      const attendance = await Attendance.create({
        schoolId,
        studentId,
        classId,
        subjectId,
        teacherId,
        date: new Date(date),
        status,
        remarks,
        markedBy: teacherId,
        academicYear: '2024-2025'
      });

      return res.status(201).json({
        success: true,
        message: 'Attendance marked successfully',
        data: attendance
      });
    }
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking attendance'
    });
  }
};

// @desc    Mark bulk attendance for multiple students
// @route   POST /api/attendance/bulk
// @access  Private (Teacher)
const markBulkAttendance = async (req, res) => {
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
    const teacherId = req.user.id;

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
        const { studentId, classId, subjectId, date, status, remarks } = record;

        // Verify the teacher is authorized to mark attendance for this class
        const classData = await Class.findOne({ _id: classId, schoolId });
        if (!classData) {
          failedRecords.push({ studentId, error: 'Class not found' });
          continue;
        }

        // Verify the subject exists
        const subject = await Subject.findOne({ _id: subjectId, schoolId });
        if (!subject) {
          failedRecords.push({ studentId, error: 'Subject not found' });
          continue;
        }

        // Verify the student is in the class
        const student = await Student.findOne({ _id: studentId, classId, schoolId });
        if (!student) {
          failedRecords.push({ studentId, error: 'Student not found in this class' });
          continue;
        }

        // Check if attendance already exists for this student on this date
        const existingAttendance = await Attendance.findOne({
          schoolId,
          studentId,
          classId,
          subjectId,
          date: {
            $gte: new Date(date).setHours(0, 0, 0, 0),
            $lte: new Date(date).setHours(23, 59, 59, 999)
          },
          isActive: true
        });

        if (existingAttendance) {
          // Update existing attendance
          existingAttendance.status = status;
          existingAttendance.remarks = remarks;
          existingAttendance.markedAt = new Date();
          await existingAttendance.save();
          results.push(existingAttendance);
        } else {
          // Create new attendance record
          const attendance = await Attendance.create({
            schoolId,
            studentId,
            classId,
            subjectId,
            teacherId,
            date: new Date(date),
            status,
            remarks,
            markedBy: teacherId,
            academicYear: '2024-2025'
          });
          results.push(attendance);
        }
      } catch (recordError) {
        failedRecords.push({ 
          studentId: record.studentId, 
          error: recordError.message 
        });
      }
    }

    // Emit WebSocket event for real-time updates
    if (global.io && results.length > 0) {
      // Get the first record to determine class and date info
      const firstRecord = results[0];
      
      // Emit to school admin room for real-time updates
      const schoolAdminRoom = `school_${schoolId}`;
      global.io.to(schoolAdminRoom).emit('attendance_updated', {
        type: 'bulk_attendance_marked',
        classId: firstRecord.classId,
        subjectId: firstRecord.subjectId,
        date: firstRecord.date,
        teacherId: teacherId,
        successfulCount: results.length,
        failedCount: failedRecords.length,
        records: results.map(record => ({
          studentId: record.studentId,
          status: record.status,
          markedAt: record.markedAt
        }))
      });
      
      console.log(`📡 Emitted attendance update to school room: ${schoolAdminRoom}`);
    }

    return res.status(200).json({
      success: true,
      message: `Attendance marked for ${results.length} students`,
      data: {
        successful: results,
        failed: failedRecords
      }
    });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking bulk attendance'
    });
  }
};

// @desc    Get attendance for a specific class and date (all subjects)
// @route   GET /api/attendance/class-date
// @access  Private (Teacher, School Admin)
const getClassDateAttendance = async (req, res) => {
  try {
    const { classId, date, academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Class ID and Date are required'
      });
    }

    // Get all attendance records for the class and date
    const attendance = await Attendance.find({
      schoolId,
      classId,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999)
      },
      academicYear,
      isActive: true
    })
    .populate('studentId', 'name rollNumber email')
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('teacherId', 'name email')
    .populate('markedBy', 'name email')
    .sort({ 'studentId.rollNumber': 1, 'subjectId.name': 1 });

    // Filter out any attendance records with invalid student data
    const validAttendance = attendance.filter(record => {
      try {
        // Try to serialize the record to check for any JSON issues
        JSON.stringify(record);
        return true;
      } catch (err) {
        console.error('Invalid attendance record:', record._id, err.message);
        return false;
      }
    });

    res.status(200).json({
      success: true,
      count: validAttendance.length,
      data: validAttendance
    });
  } catch (error) {
    console.error('Get class date attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching class attendance'
    });
  }
};

// @desc    Get attendance for a specific class and date
// @route   GET /api/attendance
// @access  Private (Teacher, School Admin)
const getAttendance = async (req, res) => {
  try {
    const { classId, subjectId, date, academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Class ID, Subject ID, and Date are required'
      });
    }

    const attendance = await Attendance.getAttendanceByClassAndDate(
      classId, 
      subjectId, 
      new Date(date), 
      academicYear
    );

    // Filter out any attendance records with invalid student data
    const validAttendance = attendance.filter(record => {
      try {
        // Try to serialize the record to check for any JSON issues
        JSON.stringify(record);
        return true;
      } catch (err) {
        console.error('Invalid attendance record:', record._id, err.message);
        return false;
      }
    });

    res.status(200).json({
      success: true,
      count: validAttendance.length,
      data: validAttendance
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching attendance'
    });
  }
};

// @desc    Get attendance statistics for a student
// @route   GET /api/attendance/student/:studentId
// @access  Private (Teacher, School Admin, Parent)
const getStudentAttendanceStats = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    // Verify student exists and user has access
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const stats = await Attendance.getStudentAttendanceStats(studentId, academicYear);
    
    // Calculate totals and percentages
    const totalClasses = stats.reduce((sum, stat) => sum + stat.count, 0);
    const presentCount = stats.find(s => s._id === 'present')?.count || 0;
    const absentCount = stats.find(s => s._id === 'absent')?.count || 0;
    const lateCount = stats.find(s => s._id === 'late')?.count || 0;
    const excusedCount = stats.find(s => s._id === 'excused')?.count || 0;
    
    const attendancePercentage = totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.classId
        },
        statistics: {
          totalClasses,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          attendancePercentage: Math.round(attendancePercentage * 100) / 100
        },
        breakdown: stats
      }
    });
  } catch (error) {
    console.error('Get student attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student attendance statistics'
    });
  }
};

// @desc    Get attendance statistics for a class
// @route   GET /api/attendance/class/:classId
// @access  Private (Teacher, School Admin)
const getClassAttendanceStats = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    // Verify class exists and user has access
    const classData = await Class.findOne({ _id: classId, schoolId });
    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    const stats = await Attendance.getClassAttendanceStats(classId, academicYear);

    res.status(200).json({
      success: true,
      data: {
        class: {
          id: classData._id,
          name: classData.name,
          section: classData.section
        },
        statistics: stats,
        summary: {
          totalStudents: stats.length,
          averageAttendance: stats.length > 0 
            ? Math.round((stats.reduce((sum, s) => sum + s.attendancePercentage, 0) / stats.length) * 100) / 100 
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get class attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching class attendance statistics'
    });
  }
};

// @desc    Update attendance record
// @route   PUT /api/attendance/:id
// @access  Private (Teacher, School Admin)
const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const schoolId = req.user.schoolId;

    const attendance = await Attendance.findOne({ _id: id, schoolId, isActive: true });
    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found'
      });
    }

    attendance.status = status;
    attendance.remarks = remarks;
    attendance.markedAt = new Date();
    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating attendance'
    });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Private (School Admin)
const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const attendance = await Attendance.findOne({ _id: id, schoolId, isActive: true });
    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found'
      });
    }

    attendance.isActive = false;
    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting attendance'
    });
  }
};

module.exports = {
  markAttendance,
  markBulkAttendance,
  getAttendance,
  getClassDateAttendance,
  getStudentAttendanceStats,
  getClassAttendanceStats,
  updateAttendance,
  deleteAttendance
};
