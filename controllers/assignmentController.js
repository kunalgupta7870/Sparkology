const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

// WebSocket instance (will be injected)
let io = null;

// Function to set WebSocket instance
const setSocketIO = (socketIO) => {
  io = socketIO;
  console.log('🔌 Assignment Controller: SocketIO instance set:', !!io);
};

// @desc    Get all assignments for a teacher
// @route   GET /api/assignments
// @access  Private (Teacher, School Admin)
const getAssignments = async (req, res) => {
  try {
    const { status, startDate, endDate, classId, subjectId } = req.query;
    const schoolId = req.user.schoolId;
    const userRole = req.user.role;

    // Build query
    const query = { schoolId };
    
    // If teacher, only show their assignments
    if (userRole === 'teacher') {
      query.teacherId = req.user._id;
    }
    
    if (status) query.status = status;
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    
    if (startDate || endDate) {
      query.dueDate = {};
      if (startDate) query.dueDate.$gte = new Date(startDate);
      if (endDate) query.dueDate.$lte = new Date(endDate);
    }

    const assignments = await Assignment.find(query)
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ dueDate: -1, createdAt: -1 });

    // Add submission count for each assignment
    const assignmentsWithStats = await Promise.all(
      assignments.map(async (assignment) => {
        const totalStudents = await Student.countDocuments({ 
          classId: assignment.classId._id,
          status: 'active'
        });
        
        const submittedCount = assignment.submissions.filter(
          s => s.status !== 'pending'
        ).length;

        return {
          ...assignment.toObject(),
          submissionCount: submittedCount,
          totalStudents
        };
      })
    );

    res.status(200).json({
      success: true,
      count: assignmentsWithStats.length,
      data: assignmentsWithStats
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching assignments'
    });
  }
};

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Private (Teacher, School Admin, Student, Parent)
const getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('submissions.studentId', 'name rollNumber');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check access based on role
    if (req.user.role === 'teacher' && assignment.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // For students, verify they are in the assignment's class
    if (req.user.role === 'student') {
      // req.user is already the Student document
      if (!req.user.classId || req.user.classId.toString() !== assignment.classId._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - not in assignment class'
        });
      }
    }

    // For parents, verify their child is in the assignment's class
    if (req.user.role === 'parent') {
      // req.user is already the Parent document with studentId
      if (!req.user.studentId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - parent has no associated student'
        });
      }
      
      // Get the parent's child to check their class
      const child = await Student.findById(req.user.studentId);
      if (!child || child.classId.toString() !== assignment.classId._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - child not in assignment class'
        });
      }
    }

    const totalStudents = await Student.countDocuments({ 
      classId: assignment.classId._id,
      status: 'active'
    });

    res.status(200).json({
      success: true,
      data: {
        ...assignment.toObject(),
        totalStudents
      }
    });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching assignment'
    });
  }
};

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private (Teacher, School Admin)
const createAssignment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      title,
      description,
      classId,
      subjectId,
      dueDate,
      dueTime,
      attachments,
      totalMarks
    } = req.body;

    console.log('📥 Backend: Received assignment data:', {
      title,
      description,
      classId,
      subjectId,
      dueDate,
      dueTime,
      attachments,
      totalMarks
    });

    const schoolId = req.user.schoolId;
    const teacherId = req.user._id;

    // Verify class and subject belong to teacher
    const classData = await Class.findOne({ _id: classId, schoolId });
    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    const subject = await Subject.findOne({ 
      _id: subjectId, 
      classId,
      teacherId,
      schoolId 
    });
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found or you do not teach this subject to this class'
      });
    }

    // Create assignment
    const assignmentData = {
      title,
      description,
      classId,
      subjectId,
      teacherId,
      schoolId,
      dueDate,
      dueTime,
      attachments: attachments || [],
      totalMarks: totalMarks || 0,
      createdBy: teacherId
    };

    console.log('💾 Backend: Creating assignment with data:', assignmentData);
    const assignment = await Assignment.create(assignmentData);
    console.log('✅ Backend: Assignment created successfully:', assignment);

    // Populate the created assignment
    await assignment.populate([
      { path: 'classId', select: 'name section room' },
      { path: 'subjectId', select: 'name code' },
      { path: 'teacherId', select: 'name email' }
    ]);

    // Get all students in the class to create notifications
    const students = await Student.find({ 
      classId: assignment.classId._id,
      schoolId: assignment.schoolId,
      status: 'active'
    });

    // Create notifications for all students in the class
    let createdNotifications = [];
    if (students.length > 0) {
      try {
        createdNotifications = await Notification.createAssignmentNotification(assignment, students);
        console.log(`📢 Created assignment notifications for ${students.length} students`);
      } catch (notificationError) {
        console.error('Error creating assignment notifications:', notificationError);
        // Don't fail the assignment creation if notifications fail
      }
    }

    // Emit WebSocket event to notify students and parents about new assignment
    if (io && students.length > 0) {
      console.log(`📤 Backend: Emitting new_assignment event to ${students.length} students and their parents`);
      console.log(`📤 Backend: Io instance available:`, !!io);
      console.log(`📤 Backend: Students to notify:`, students.map(s => ({ id: s._id, name: s.name })));
      
      // Get all parents for these students
      const studentIds = students.map(s => s._id);
      const Parent = require('../models/Parent');
      const parents = await Parent.find({ studentId: { $in: studentIds } });
      console.log(`📤 Backend: Found ${parents.length} parents to notify`);
      
      // Emit to each student in the class
      students.forEach(student => {
        const roomName = `user_${student._id}`;
        console.log(`📤 Backend: Emitting to student room: ${roomName} for student: ${student.name}`);
        
        const assignmentData = assignment.toObject();
        console.log('📤 Backend: Assignment data being emitted:', {
          title: assignmentData.title,
          classId: assignmentData.classId,
          classIdType: typeof assignmentData.classId,
          classIdValue: assignmentData.classId
        });
        
        io.to(roomName).emit('new_assignment', {
          success: true,
          assignment: assignmentData, // Convert to plain object
          message: `New assignment: ${assignment.title}`
        });
        
        // Emit notification event for each student
        const studentNotification = createdNotifications.find(n => n.recipient.toString() === student._id.toString());
        if (studentNotification) {
          console.log(`📢 Backend: Emitting new_notification event to student room: ${roomName}`);
          io.to(roomName).emit('new_notification', {
            success: true,
            notification: studentNotification,
            message: `New notification: ${studentNotification.title}`
          });
        }
      });
      
      // Emit to each parent of students in the class
      parents.forEach(parent => {
        const parentRoomName = `user_${parent._id}`;
        console.log(`📤 Backend: Emitting to parent room: ${parentRoomName} for parent: ${parent.name}`);
        
        const assignmentData = assignment.toObject();
        
        io.to(parentRoomName).emit('new_assignment', {
          success: true,
          assignment: assignmentData,
          message: `New assignment for your child: ${assignment.title}`
        });
        
        // Also emit notification to parent
        const parentNotification = createdNotifications.find(n => n.recipient.toString() === parent.studentId.toString());
        if (parentNotification) {
          console.log(`📢 Backend: Emitting new_notification event to parent room: ${parentRoomName}`);
          io.to(parentRoomName).emit('new_notification', {
            success: true,
            notification: parentNotification,
            message: `New notification for your child: ${parentNotification.title}`
          });
        }
      });
    } else {
      console.log(`❌ Backend: Cannot emit assignment event - io:`, !!io, 'students:', students.length);
    }

    const totalStudents = students.length;

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: {
        ...assignment.toObject(),
        submissionCount: 0,
        totalStudents,
        notificationsCreated: students.length
      }
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating assignment'
    });
  }
};

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private (Teacher, School Admin)
const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check access
    if (req.user.role === 'teacher' && assignment.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const {
      title,
      description,
      dueDate,
      dueTime,
      attachments,
      totalMarks,
      status
    } = req.body;

    // Update fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = dueDate;
    if (dueTime !== undefined) assignment.dueTime = dueTime;
    if (attachments) assignment.attachments = attachments;
    if (totalMarks !== undefined) assignment.totalMarks = totalMarks;
    if (status) assignment.status = status;
    assignment.updatedBy = req.user._id;

    await assignment.save();

    // Populate the updated assignment
    await assignment.populate([
      { path: 'classId', select: 'name section room' },
      { path: 'subjectId', select: 'name code' },
      { path: 'teacherId', select: 'name email' }
    ]);

    const totalStudents = await Student.countDocuments({ 
      classId: assignment.classId._id,
      status: 'active'
    });

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: {
        ...assignment.toObject(),
        totalStudents
      }
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating assignment'
    });
  }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Teacher, School Admin)
const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check access
    if (req.user.role === 'teacher' && assignment.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await Assignment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting assignment'
    });
  }
};

// @desc    Get teacher's classes with subjects
// @route   GET /api/assignments/teacher/classes
// @access  Private (Teacher)
const getTeacherClasses = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const schoolId = req.user.schoolId;

    // Get all subjects that the teacher teaches
    const subjects = await Subject.find({ 
      teacherId, 
      schoolId,
      status: 'active'
    })
    .populate('classId', 'name section room')
    .sort({ classId: 1 });

    // Group subjects by class
    const classesBySubject = {};
    subjects.forEach(subject => {
      if (subject.classId) {
        const classKey = subject.classId._id.toString();
        if (!classesBySubject[classKey]) {
          classesBySubject[classKey] = {
            _id: subject.classId._id,
            name: subject.classId.name,
            section: subject.classId.section,
            room: subject.classId.room,
            subjects: []
          };
        }
        classesBySubject[classKey].subjects.push({
          _id: subject._id,
          name: subject.name,
          code: subject.code
        });
      }
    });

    const classes = Object.values(classesBySubject);

    res.status(200).json({
      success: true,
      count: classes.length,
      data: classes
    });
  } catch (error) {
    console.error('Get teacher classes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching classes'
    });
  }
};

module.exports = {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getTeacherClasses,
  setSocketIO
};

