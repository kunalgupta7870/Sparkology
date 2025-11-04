const Quiz = require('../models/Quiz');
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
  console.log('🔌 Quiz Controller: SocketIO instance set:', !!io);
};

// @desc    Get all quizzes for a teacher
// @route   GET /api/quizzes
// @access  Private (Teacher, School Admin)
const getQuizzes = async (req, res) => {
  try {
    const { status, startDate, endDate, classId, subjectId } = req.query;
    const schoolId = req.user.schoolId;
    const userRole = req.user.role;

    // Build query
    const query = { schoolId };
    
    // If teacher, only show their quizzes
    if (userRole === 'teacher') {
      query.teacherId = req.user._id;
    }
    
    if (status) query.status = status;
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const quizzes = await Quiz.find(query)
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ startDate: -1, createdAt: -1 });

    // Add submission count and stats for each quiz
    const quizzesWithStats = await Promise.all(
      quizzes.map(async (quiz) => {
        const totalStudents = await Student.countDocuments({ 
          classId: quiz.classId._id,
          status: 'active'
        });
        
        const submittedCount = quiz.submissions.filter(
          s => s.status === 'submitted' || s.status === 'graded'
        ).length;

        return {
          ...quiz.toObject(),
          submissionCount: submittedCount,
          totalStudents,
          averageScore: quiz.averageScore
        };
      })
    );

    res.status(200).json({
      success: true,
      count: quizzesWithStats.length,
      data: quizzesWithStats
    });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quizzes'
    });
  }
};

// @desc    Get single quiz
// @route   GET /api/quizzes/:id
// @access  Private (Teacher, School Admin, Student, Parent)
const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('submissions.studentId', 'name rollNumber');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Check access based on role
    if (req.user.role === 'teacher' && quiz.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // For students, verify they are in the quiz's class
    if (req.user.role === 'student') {
      if (!req.user.classId || req.user.classId.toString() !== quiz.classId._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - not in quiz class'
        });
      }
      
      // For students, hide correct answers until they submit (if showCorrectAnswers is false during quiz)
      const studentSubmission = quiz.getStudentSubmission(req.user._id);
      const quizObj = quiz.toObject();
      
      if (!studentSubmission || studentSubmission.status === 'in-progress') {
        // Hide correct answers and explanations while quiz is in progress
        quizObj.questions = quizObj.questions.map(q => ({
          ...q,
          options: q.options ? q.options.map(opt => ({
            text: opt.text,
            _id: opt._id
            // Hide isCorrect
          })) : undefined,
          correctAnswer: undefined,
          explanation: undefined
        }));
      }
      
      return res.status(200).json({
        success: true,
        data: {
          ...quizObj,
          studentSubmission
        }
      });
    }

    // For parents, verify their child is in the quiz's class
    if (req.user.role === 'parent') {
      if (!req.user.studentId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - parent has no associated student'
        });
      }
      
      const child = await Student.findById(req.user.studentId);
      if (!child || child.classId.toString() !== quiz.classId._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - child not in quiz class'
        });
      }
    }

    const totalStudents = await Student.countDocuments({ 
      classId: quiz.classId._id,
      status: 'active'
    });

    res.status(200).json({
      success: true,
      data: {
        ...quiz.toObject(),
        totalStudents,
        submissionCount: quiz.submissionCount,
        averageScore: quiz.averageScore
      }
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quiz'
    });
  }
};

// @desc    Create new quiz
// @route   POST /api/quizzes
// @access  Private (Teacher, School Admin)
const createQuiz = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      classId,
      subjectId,
      questions,
      duration,
      passingMarks,
      startDate,
      endDate,
      allowLateSubmission,
      shuffleQuestions,
      showCorrectAnswers,
      status
    } = req.body;

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

    // Validate questions
    if (!questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Quiz must have at least one question'
      });
    }

    // Create quiz
    const quiz = await Quiz.create({
      name,
      description,
      classId,
      subjectId,
      teacherId,
      schoolId,
      questions,
      duration,
      passingMarks: passingMarks || 0,
      startDate,
      endDate,
      allowLateSubmission: allowLateSubmission || false,
      shuffleQuestions: shuffleQuestions || false,
      showCorrectAnswers: showCorrectAnswers !== undefined ? showCorrectAnswers : true,
      status: status || 'draft',
      createdBy: teacherId
    });

    // Populate the created quiz
    await quiz.populate([
      { path: 'classId', select: 'name section room' },
      { path: 'subjectId', select: 'name code' },
      { path: 'teacherId', select: 'name email' }
    ]);

    // Get all students in the class to create notifications (only if quiz is active)
    if (quiz.status === 'active') {
      const students = await Student.find({ 
        classId: quiz.classId._id,
        schoolId: quiz.schoolId,
        status: 'active'
      });

      // Create notifications for all students in the class
      if (students.length > 0) {
        try {
          const notifications = await Promise.all(
            students.map(student => 
              Notification.create({
                title: 'New Quiz Available',
                message: `New quiz "${quiz.name}" is now available for ${quiz.subjectId.name}`,
                type: 'quiz',
                recipient: student._id,
                recipientModel: 'Student',
                sender: teacherId,
                schoolId: quiz.schoolId,
                relatedId: quiz._id,
                relatedType: 'quiz',
                isRead: false,
                priority: 'high',
                icon: 'clipboard',
                color: '#8B5CF6'
              })
            )
          );
          
          console.log(`📢 Created quiz notifications for ${students.length} students`);

          // Send push notifications to students
          try {
            const { sendPushNotificationsToUsers } = require('../utils/pushNotifications');
            const studentIds = students.map(s => s._id.toString());
            await sendPushNotificationsToUsers(
              studentIds,
              'Student',
              'New Quiz Available',
              `New quiz "${quiz.name}" is now available for ${quiz.subjectId.name}`,
              {
                type: 'quiz',
                quizId: quiz._id.toString(),
                relatedId: quiz._id.toString(),
                relatedType: 'quiz'
              }
            );
            console.log(`📱 Sent push notifications for quiz to ${students.length} students`);
          } catch (pushError) {
            console.error('Error sending push notifications for quiz:', pushError);
            // Don't fail if push notifications fail
          }

          // Emit WebSocket event to notify students about new quiz
          if (io) {
            students.forEach(student => {
              const roomName = `user_${student._id}`;
              io.to(roomName).emit('new_quiz', {
                success: true,
                quiz: quiz.toObject(),
                message: `New quiz: ${quiz.name}`
              });
              
              io.to(roomName).emit('new_notification', {
                success: true,
                notification: notifications.find(n => n.recipient.toString() === student._id.toString()),
                message: `New quiz available: ${quiz.name}`
              });
            });
          }
        } catch (notificationError) {
          console.error('Error creating quiz notifications:', notificationError);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      data: quiz
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating quiz'
    });
  }
};

// @desc    Update quiz
// @route   PUT /api/quizzes/:id
// @access  Private (Teacher, School Admin)
const updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Check access
    if (req.user.role === 'teacher' && quiz.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Don't allow updates if quiz has submissions
    if (quiz.submissions.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update quiz that has submissions'
      });
    }

    const {
      name,
      description,
      questions,
      duration,
      passingMarks,
      startDate,
      endDate,
      allowLateSubmission,
      shuffleQuestions,
      showCorrectAnswers,
      status
    } = req.body;

    // Update fields
    if (name) quiz.name = name;
    if (description !== undefined) quiz.description = description;
    if (questions) quiz.questions = questions;
    if (duration) quiz.duration = duration;
    if (passingMarks !== undefined) quiz.passingMarks = passingMarks;
    if (startDate) quiz.startDate = startDate;
    if (endDate) quiz.endDate = endDate;
    if (allowLateSubmission !== undefined) quiz.allowLateSubmission = allowLateSubmission;
    if (shuffleQuestions !== undefined) quiz.shuffleQuestions = shuffleQuestions;
    if (showCorrectAnswers !== undefined) quiz.showCorrectAnswers = showCorrectAnswers;
    if (status) quiz.status = status;
    quiz.updatedBy = req.user._id;

    await quiz.save();

    // Populate the updated quiz
    await quiz.populate([
      { path: 'classId', select: 'name section room' },
      { path: 'subjectId', select: 'name code' },
      { path: 'teacherId', select: 'name email' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Quiz updated successfully',
      data: quiz
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating quiz'
    });
  }
};

// @desc    Delete quiz
// @route   DELETE /api/quizzes/:id
// @access  Private (Teacher, School Admin)
const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Check access
    if (req.user.role === 'teacher' && quiz.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await Quiz.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting quiz'
    });
  }
};

// @desc    Start quiz (Student)
// @route   POST /api/quizzes/:id/start
// @access  Private (Student)
const startQuiz = async (req, res) => {
  try {
    const quizId = req.params.id;
    const studentId = req.user._id;

    const quiz = await Quiz.findById(quizId)
      .populate('subjectId', 'name')
      .populate('classId', 'name');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Check if student is in the same class
    const student = await Student.findById(studentId);
    if (!student || student.classId.toString() !== quiz.classId._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to take this quiz'
      });
    }

    try {
      await quiz.startQuiz(studentId);

      res.status(200).json({
        success: true,
        message: 'Quiz started successfully',
        data: {
          quizId: quiz._id,
          startedAt: new Date(),
          duration: quiz.duration
        }
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
  } catch (error) {
    console.error('Start quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while starting quiz'
    });
  }
};

// @desc    Submit quiz (Student)
// @route   POST /api/quizzes/:id/submit
// @access  Private (Student)
const submitQuiz = async (req, res) => {
  try {
    const quizId = req.params.id;
    const studentId = req.user._id;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        error: 'Answers are required and must be an array'
      });
    }

    const quiz = await Quiz.findById(quizId)
      .populate('subjectId', 'name')
      .populate('classId', 'name');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Check if student is in the same class
    const student = await Student.findById(studentId);
    if (!student || student.classId.toString() !== quiz.classId._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to submit this quiz'
      });
    }

    try {
      await quiz.submitQuiz(studentId, answers);
      
      const submission = quiz.getStudentSubmission(studentId);

      // Create notification for teacher
      await Notification.create({
        title: 'Quiz Submitted',
        message: `${student.name} submitted quiz: ${quiz.name}`,
        type: 'quiz_submission',
        recipient: quiz.teacherId,
        recipientModel: 'User',
        sender: studentId,
        schoolId: quiz.schoolId,
        relatedId: quizId,
        relatedType: 'quiz',
        isRead: false,
        priority: 'medium',
        icon: 'checkmark-done',
        color: '#10B981'
      });

      // Emit real-time notification
      if (io) {
        const teacherRoom = `user_${quiz.teacherId.toString()}`;
        io.to(teacherRoom).emit('quiz_submitted', {
          success: true,
          quizId: quizId,
          studentId: studentId,
          studentName: student.name,
          submission: submission
        });
      }

      res.status(200).json({
        success: true,
        message: 'Quiz submitted successfully',
        data: {
          totalMarks: submission.totalMarks,
          percentage: submission.percentage,
          passed: submission.passed,
          timeTaken: submission.timeTaken
        }
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while submitting quiz'
    });
  }
};

// @desc    Get student's quiz submissions
// @route   GET /api/quizzes/my-submissions
// @access  Private (Student)
const getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user._id;

    const quizzes = await Quiz.find({
      'submissions.studentId': studentId
    })
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ startDate: -1 });

    const submissions = [];
    
    quizzes.forEach(quiz => {
      const submission = quiz.submissions.find(
        s => s.studentId.toString() === studentId.toString()
      );

      if (submission) {
        submissions.push({
          _id: submission._id,
          quizId: quiz._id,
          quizName: quiz.name,
          subject: quiz.subjectId,
          class: quiz.classId,
          totalMarks: submission.totalMarks,
          quizTotalMarks: quiz.totalMarks,
          percentage: submission.percentage,
          passed: submission.passed,
          timeTaken: submission.timeTaken,
          submittedAt: submission.submittedAt,
          status: submission.status,
          feedback: submission.feedback
        });
      }
    });

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

// @desc    Get quiz results for teacher
// @route   GET /api/quizzes/:id/results
// @access  Private (Teacher, School Admin)
const getQuizResults = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('submissions.studentId', 'name rollNumber email');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Check access
    if (req.user.role === 'teacher' && quiz.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const results = quiz.submissions
      .filter(s => s.status === 'submitted' || s.status === 'graded')
      .map(submission => ({
        student: submission.studentId,
        totalMarks: submission.totalMarks,
        percentage: submission.percentage,
        passed: submission.passed,
        timeTaken: submission.timeTaken,
        submittedAt: submission.submittedAt,
        status: submission.status
      }));

    res.status(200).json({
      success: true,
      data: {
        quiz: {
          _id: quiz._id,
          name: quiz.name,
          totalMarks: quiz.totalMarks,
          passingMarks: quiz.passingMarks
        },
        results,
        stats: {
          totalSubmissions: results.length,
          averageScore: quiz.averageScore,
          passedCount: results.filter(r => r.passed).length,
          failedCount: results.filter(r => !r.passed).length
        }
      }
    });
  } catch (error) {
    console.error('Get quiz results error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quiz results'
    });
  }
};

module.exports = {
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  startQuiz,
  submitQuiz,
  getMySubmissions,
  getQuizResults,
  setSocketIO
};






