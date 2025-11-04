const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');
const { uploadDocument, uploadToCloudinary } = require('../utils/cloudinary');
const fs = require('fs');
const path = require('path');

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
      .populate('submissions.studentId', 'name rollNumber')
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
    // Skip express-validator for multipart form data
    // We'll do manual validation instead

    const {
      title,
      description,
      classId,
      subjectId,
      dueDate,
      dueTime,
      attachments,
      totalMarks,
      points
    } = req.body;

    console.log('📥 Backend: Received assignment data:', {
      title,
      description,
      classId,
      subjectId,
      dueDate,
      dueTime,
      attachments,
      totalMarks,
      points,
      files: req.files?.length || 0
    });
    
    console.log('📥 Backend: req.files details:', JSON.stringify(req.files, null, 2));

    // Manual validation
    if (!title || !description || !classId || !subjectId || !dueDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description, classId, subjectId, and dueDate are required'
      });
    }

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

    // Prepare attachments from uploaded files (Local Storage)
    const fileAttachments = [];
    if (req.files && req.files.length > 0) {
      console.log('📎 Backend: Processing', req.files.length, 'files');
      
      req.files.forEach((file, index) => {
        console.log(`📎 Backend: File ${index}:`, {
          originalname: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size
        });
        
        // Use local file path
        const fileUrl = `/uploads/documents/${file.filename}`;
        
        console.log(`📎 Backend: Local file URL: ${fileUrl}`);
        
        fileAttachments.push({
          name: file.originalname,
          url: fileUrl, // Local file URL
          type: 'pdf',
          size: file.size,
          localPath: file.path // Store full local path for deletion
        });
      });
      
      console.log('📎 Backend: Prepared attachments array:', JSON.stringify(fileAttachments, null, 2));
    }

    // Create assignment - Build data object carefully
    const assignmentData = {
      title,
      description,
      classId,
      subjectId,
      teacherId,
      schoolId,
      dueDate,
      dueTime,
      totalMarks: parseInt(totalMarks) || 0,
      points: parseInt(points) || 0,
      createdBy: teacherId
    };
    
    // Add attachments separately to avoid any stringification
    if (fileAttachments.length > 0) {
      assignmentData.attachments = fileAttachments;
    } else if (attachments) {
      assignmentData.attachments = attachments;
    } else {
      assignmentData.attachments = [];
    }

    console.log('💾 Backend: Assignment data type check:', {
      attachmentsIsArray: Array.isArray(assignmentData.attachments),
      attachmentsLength: assignmentData.attachments?.length,
      attachmentsType: typeof assignmentData.attachments,
      firstAttachment: assignmentData.attachments[0]
    });
    
    // Use new Assignment() instead of create() to avoid casting issues
    const assignment = new Assignment(assignmentData);
    await assignment.save();
    
    console.log('✅ Backend: Assignment created successfully with ID:', assignment._id);

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
        
        // Send push notifications to students
        try {
          const { sendPushNotificationsToUsers } = require('../utils/pushNotifications');
          const studentIds = students.map(s => s._id.toString());
          await sendPushNotificationsToUsers(
            studentIds,
            'Student',
            'New Assignment',
            `${assignment.title} - Due ${new Date(assignment.dueDate).toLocaleDateString()}`,
            {
              type: 'assignment',
              assignmentId: assignment._id.toString(),
              relatedId: assignment._id.toString(),
              relatedType: 'assignment'
            }
          );
          console.log(`📱 Sent push notifications to ${students.length} students`);
        } catch (pushError) {
          console.error('Error sending push notifications:', pushError);
          // Don't fail if push notifications fail
        }
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

    // Clean up local files
    const filesToDelete = [];
    
    // Collect all local file paths
    if (assignment.attachments) {
      assignment.attachments.forEach(attachment => {
        if (attachment.localPath) {
          filesToDelete.push(attachment.localPath);
        }
      });
    }
    
    if (assignment.submissions) {
      assignment.submissions.forEach(submission => {
        if (submission.attachments) {
          submission.attachments.forEach(attachment => {
            if (attachment.localPath) {
              filesToDelete.push(attachment.localPath);
            }
          });
        }
      });
    }
    
    // Delete assignment from database
    await Assignment.findByIdAndDelete(req.params.id);

    // Clean up local files
    if (filesToDelete.length > 0) {
      filesToDelete.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ Deleted local file: ${filePath}`);
          }
        } catch (fileError) {
          console.error(`Error deleting file ${filePath}:`, fileError);
          // Don't fail the deletion if file cleanup fails
        }
      });
      console.log(`✅ Cleaned up ${filesToDelete.length} local files for assignment ${req.params.id}`);
    }

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

// @desc    Submit assignment (Student)
// @route   POST /api/assignments/:id/submit
// @access  Private (Student)
const submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const studentId = req.user._id;

    // Find the assignment
    const assignment = await Assignment.findById(assignmentId)
      .populate('subjectId', 'name')
      .populate('classId', 'name');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check if student is in the same class
    const student = await Student.findById(studentId);
    if (!student || student.classId.toString() !== assignment.classId._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to submit this assignment'
      });
    }

    // Check if student has already submitted
    const existingSubmission = assignment.submissions.find(
      sub => sub.studentId.toString() === studentId.toString()
    );
    
    console.log(`📝 Backend: Checking submission for student ${studentId}, assignment ${assignmentId}`);
    console.log(`📝 Backend: Existing submission:`, existingSubmission ? {
      status: existingSubmission.status,
      submittedAt: existingSubmission.submittedAt
    } : 'none');
    
    if (existingSubmission && existingSubmission.status !== 'pending') {
      console.log(`📝 Backend: Student has already submitted this assignment with status: ${existingSubmission.status}`);
      return res.status(400).json({
        success: false,
        error: 'Assignment already submitted. You cannot submit this assignment again.',
        alreadySubmitted: true,
        submission: {
          submittedAt: existingSubmission.submittedAt,
          status: existingSubmission.status,
          marks: existingSubmission.marks,
          feedback: existingSubmission.feedback
        }
      });
    }

    // Prepare attachments from uploaded files (Local Storage)
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fileUrl = `/uploads/documents/${file.filename}`;
        attachments.push({
          name: file.originalname,
          url: fileUrl, // Local file URL
          type: 'pdf',
          size: file.size,
          localPath: file.path // Store full local path for deletion
        });
      });
    }

    // Add submission to assignment
    await assignment.addSubmission(studentId, attachments);

    // Award points to student
    // Compare dates at day level (not including time) to check if same day
    const dueDateOnly = new Date(assignment.dueDate);
    dueDateOnly.setHours(0, 0, 0, 0);
    const nowDateOnly = new Date();
    nowDateOnly.setHours(0, 0, 0, 0);
    
    // Only mark as late if submitted AFTER the due date (not on the due date)
    const isLate = nowDateOnly > dueDateOnly;
    
    await student.addPoints(
      assignmentId,
      isLate ? Math.floor(assignment.points * 0.5) : assignment.points,
      assignment.title,
      assignment.subjectId.name,
      isLate
    );

    // Create notification for teacher
    await Notification.create({
      title: 'New Assignment Submission',
      message: `${student.name} submitted assignment: ${assignment.title}`,
      type: 'assignment_submission',
      recipient: assignment.teacherId,
      recipientModel: 'User',
      sender: studentId,
      schoolId: assignment.schoolId,
      relatedId: assignmentId,
      relatedType: 'assignment',
      isRead: false,
      priority: 'high',
      icon: 'checkmark-circle',
      color: '#10B981'
    });

    // Emit real-time notification and submission update
    if (io) {
      const teacherRoom = `user_${assignment.teacherId.toString()}`;
      
      console.log(`📢 Backend: Preparing to emit to teacher room: ${teacherRoom}`);
      console.log(`📢 Backend: Teacher ID: ${assignment.teacherId.toString()}`);
      console.log(`📢 Backend: Student: ${student.name}`);
      console.log(`📢 Backend: Assignment: ${assignment.title}`);
      
      // Check if the room exists and has clients
      const roomClients = io.sockets.adapter.rooms.get(teacherRoom);
      console.log(`📢 Backend: Room "${teacherRoom}" has ${roomClients ? roomClients.size : 0} clients`);
      if (roomClients) {
        console.log(`📢 Backend: Clients in room:`, Array.from(roomClients));
      }
      
      // Emit notification
      io.to(teacherRoom).emit('new_notification', {
        success: true,
        notification: {
          title: 'New Assignment Submission',
          message: `${student.name} submitted assignment: ${assignment.title}`,
          type: 'assignment_submission'
        }
      });
      
      // Get updated assignment with submission count
      const updatedAssignment = await Assignment.findById(assignmentId)
        .populate('classId', 'name section room')
        .populate('subjectId', 'name code')
        .populate('teacherId', 'name email');
      
      const totalStudents = await Student.countDocuments({ 
        classId: updatedAssignment.classId._id,
        status: 'active'
      });
      
      const submittedCount = updatedAssignment.submissions.filter(
        s => s.status !== 'pending'
      ).length;
      
      // Emit assignment submission event with full updated data
      io.to(teacherRoom).emit('assignment_submitted', {
        success: true,
        assignmentId: assignmentId,
        studentId: studentId,
        studentName: student.name,
        submittedAt: new Date(),
        pointsEarned: isLate ? Math.floor(assignment.points * 0.5) : assignment.points,
        isLate: isLate,
        assignment: {
          ...updatedAssignment.toObject(),
          submissionCount: submittedCount,
          totalStudents: totalStudents
        }
      });
      
      console.log(`📢 Backend: ✅ ✅ ✅ Emitted assignment_submitted event to teacher room: ${teacherRoom}`);
      console.log(`📢 Backend: Event data:`, {
        assignmentId,
        studentName: student.name,
        pointsEarned: isLate ? Math.floor(assignment.points * 0.5) : assignment.points
      });
      
      // Also broadcast to all connected clients as a test
      io.emit('test_broadcast', {
        message: `Student ${student.name} submitted assignment - broadcast test`,
        teacherRoom: teacherRoom
      });
      console.log(`📢 Backend: Also sent test broadcast to ALL clients`);
      
    } else {
      console.log(`❌ Backend: io is not available, cannot emit events`);
    }

    res.status(200).json({
      success: true,
      message: 'Assignment submitted successfully',
      data: {
        pointsEarned: isLate ? Math.floor(assignment.points * 0.5) : assignment.points,
        isLate: isLate,
        submissionTime: new Date()
      }
    });

  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while submitting assignment'
    });
  }
};

// @desc    Get student's assignment submissions
// @route   GET /api/assignments/my-submissions
// @access  Private (Student)
const getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user._id;

    const assignments = await Assignment.find({
      'submissions.studentId': studentId
    })
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ dueDate: -1 });

    // Return flat structure with assignmentId for easier frontend checking
    const submissions = [];
    
    assignments.forEach(assignment => {
      const submission = assignment.submissions.find(
        s => s.studentId.toString() === studentId.toString()
      );

      // Only include non-pending submissions (actually submitted)
      if (submission && submission.status !== 'pending') {
        submissions.push({
          _id: submission._id,
          assignmentId: assignment._id, // This is what frontend checks
          submittedAt: submission.submittedAt,
          files: submission.attachments || [],
          attachments: submission.attachments || [],
          pointsEarned: submission.pointsEarned,
          marks: submission.marks,
          feedback: submission.feedback,
          status: submission.status
        });
      }
    });

    console.log(`📝 Backend: Returning ${submissions.length} submissions for student ${studentId}`);
    console.log(`📝 Backend: Submissions:`, submissions.map(s => ({
      id: s._id,
      assignmentId: s.assignmentId,
      status: s.status
    })));

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions
    });

  } catch (error) {
    console.error('Get my submissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching submissions'
    });
  }
};

// @desc    Get assignments for a specific child (Parent access)
// @route   GET /api/assignments/child/:childId
// @access  Private (Parent)
const getChildAssignments = async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user._id;
    const schoolId = req.user.schoolId;

    // Verify the child belongs to this parent
    const Parent = require('../models/Parent');
    const Student = require('../models/Student');
    
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s assignments.'
      });
    }

    const child = await Student.findById(childId);
    if (!child || !child.classId) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not assigned to any class'
      });
    }

    // Get assignments for the child's class
    const assignments = await Assignment.find({
      classId: child.classId,
      schoolId: schoolId,
      status: 'active'
    })
    .populate('subjectId', 'name')
    .populate('classId', 'name')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching child assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child assignments'
    });
  }
};

// @desc    Get assignment submissions for a specific child (Parent access)
// @route   GET /api/assignments/child/:childId/submissions
// @access  Private (Parent)
const getChildAssignmentSubmissions = async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user._id;
    const schoolId = req.user.schoolId;

    // Verify the child belongs to this parent
    const Parent = require('../models/Parent');
    const Student = require('../models/Student');
    
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s submissions.'
      });
    }

    const child = await Student.findById(childId);
    if (!child || !child.classId) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not assigned to any class'
      });
    }

    // Get assignments for the child's class and filter submissions
    const assignments = await Assignment.find({
      classId: child.classId,
      schoolId: schoolId,
      'submissions.studentId': childId // Only assignments where this student has submitted
    })
    .populate('subjectId', 'name')
    .populate('classId', 'name')
    .sort({ 'submissions.submittedAt': -1 });

    // Extract only the student's submissions from each assignment
    const submissions = [];
    assignments.forEach(assignment => {
      const studentSubmission = assignment.submissions.find(
        sub => sub.studentId.toString() === childId
      );
      
      if (studentSubmission && studentSubmission.status !== 'pending') {
        submissions.push({
          _id: studentSubmission._id,
          assignmentId: assignment._id,
          assignmentTitle: assignment.title,
          assignmentDescription: assignment.description,
          assignmentDueDate: assignment.dueDate,
          assignmentTotalMarks: assignment.totalMarks,
          assignmentPoints: assignment.points,
          subjectId: assignment.subjectId,
          classId: assignment.classId,
          submittedAt: studentSubmission.submittedAt,
          attachments: studentSubmission.attachments,
          marks: studentSubmission.marks,
          pointsEarned: studentSubmission.pointsEarned,
          feedback: studentSubmission.feedback,
          status: studentSubmission.status
        });
      }
    });

    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('Error fetching child assignment submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child assignment submissions'
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
  submitAssignment,
  getMySubmissions,
  getChildAssignments,
  getChildAssignmentSubmissions,
  uploadDocument,
  setSocketIO
};

