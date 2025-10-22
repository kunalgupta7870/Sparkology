const mongoose = require('mongoose');
const StudentQuizAttempt = require('../models/StudentQuizAttempt');
// AdminQuiz is defined in adminQuizController, so we get the model
const AdminQuiz = mongoose.model('AdminQuiz');

// @desc    Get all available quiz battles
// @route   GET /api/student-quiz-battle/quizzes
// @access  Private (Student only)
const getAvailableQuizzes = async (req, res) => {
  try {
    const quizzes = await AdminQuiz.find({ status: 'active' })
      .select('name description timeRequired totalMarks questions')
      .sort({ createdAt: -1 });

    // For each quiz, count how many questions it has
    const quizzesWithInfo = quizzes.map(quiz => ({
      _id: quiz._id,
      name: quiz.name,
      description: quiz.description,
      timeRequired: quiz.timeRequired,
      totalMarks: quiz.totalMarks,
      questionCount: quiz.questions ? quiz.questions.length : 0
    }));

    res.status(200).json({
      success: true,
      count: quizzesWithInfo.length,
      data: quizzesWithInfo
    });
  } catch (error) {
    console.error('Get available quizzes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quizzes'
    });
  }
};

// @desc    Get single quiz battle
// @route   GET /api/student-quiz-battle/quizzes/:id
// @access  Private (Student only)
const getQuizById = async (req, res) => {
  try {
    const quiz = await AdminQuiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    if (quiz.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'This quiz is not currently available'
      });
    }

    // Return quiz without showing correct answers
    const quizData = {
      _id: quiz._id,
      name: quiz.name,
      description: quiz.description,
      timeRequired: quiz.timeRequired,
      totalMarks: quiz.totalMarks,
      questions: quiz.questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options ? q.options.map(opt => ({
          _id: opt._id,
          text: opt.text
          // Hide isCorrect from students
        })) : [],
        marks: q.marks
        // Hide correctAnswer
      }))
    };

    res.status(200).json({
      success: true,
      data: quizData
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quiz'
    });
  }
};

// @desc    Submit quiz battle attempt
// @route   POST /api/student-quiz-battle/quizzes/:id/submit
// @access  Private (Student only)
const submitQuizAttempt = async (req, res) => {
  try {
    const { answers, timeSpent } = req.body;
    const studentId = req.user._id;
    const quizId = req.params.id;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        error: 'Answers are required and must be an array'
      });
    }

    const quiz = await AdminQuiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Grade the answers
    let correctAnswers = 0;
    let score = 0;
    
    const gradedAnswers = answers.map(answer => {
      const question = quiz.questions.id(answer.questionId);
      
      if (!question) {
        return {
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect: false,
          marksAwarded: 0
        };
      }

      let isCorrect = false;
      let marksAwarded = 0;

      if (question.questionType === 'multiple-choice' || question.questionType === 'true-false') {
        const selectedOption = question.options.find(opt => opt.text === answer.selectedAnswer);
        isCorrect = selectedOption ? selectedOption.isCorrect : false;
        marksAwarded = isCorrect ? question.marks : 0;
      } else if (question.questionType === 'short-answer') {
        isCorrect = answer.selectedAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
        marksAwarded = isCorrect ? question.marks : 0;
      }

      if (isCorrect) {
        correctAnswers++;
      }
      score += marksAwarded;

      return {
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        marksAwarded
      };
    });

    const totalQuestions = quiz.questions.length;
    const percentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // Save the attempt
    const attempt = await StudentQuizAttempt.create({
      studentId,
      quizId,
      answers: gradedAnswers,
      score,
      totalQuestions,
      correctAnswers,
      percentage: parseFloat(percentage.toFixed(2)),
      timeSpent: timeSpent || 0
    });

    // Return the complete quiz with correct answers marked
    const quizWithAnswers = {
      _id: quiz._id,
      name: quiz.name,
      questions: quiz.questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options ? q.options.map(opt => ({
          _id: opt._id,
          text: opt.text,
          isCorrect: opt.isCorrect // Now include correct answers
        })) : [],
        correctAnswer: q.correctAnswer,
        marks: q.marks
      }))
    };

    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      data: {
        attemptId: attempt._id,
        score,
        totalMarks: quiz.totalMarks,
        correctAnswers,
        totalQuestions,
        percentage: attempt.percentage,
        answers: gradedAnswers,
        quiz: quizWithAnswers
      }
    });
  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while submitting quiz'
    });
  }
};

// @desc    Get my quiz attempts
// @route   GET /api/student-quiz-battle/my-attempts
// @access  Private (Student only)
const getMyAttempts = async (req, res) => {
  try {
    const studentId = req.user._id;

    const attempts = await StudentQuizAttempt.find({ studentId })
      .populate('quizId', 'name description totalMarks')
      .sort({ completedAt: -1 });

    res.status(200).json({
      success: true,
      count: attempts.length,
      data: attempts
    });
  } catch (error) {
    console.error('Get my attempts error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching attempts'
    });
  }
};

// @desc    Get my quiz battle statistics
// @route   GET /api/student-quiz-battle/my-stats
// @access  Private (Student only)
const getMyStats = async (req, res) => {
  try {
    const studentId = req.user._id;

    const attempts = await StudentQuizAttempt.find({ studentId });

    if (attempts.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalAttempts: 0,
          totalPoints: 0,
          totalCorrectAnswers: 0,
          totalQuestions: 0,
          winRate: 0,
          averageScore: 0
        }
      });
    }

    const totalAttempts = attempts.length;
    const totalPoints = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const totalCorrectAnswers = attempts.reduce((sum, attempt) => sum + attempt.correctAnswers, 0);
    const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.totalQuestions, 0);
    const winRate = totalQuestions > 0 ? (totalCorrectAnswers / totalQuestions) * 100 : 0;
    const averageScore = totalAttempts > 0 ? totalPoints / totalAttempts : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAttempts,
        totalPoints: Math.round(totalPoints),
        totalCorrectAnswers,
        totalQuestions,
        winRate: parseFloat(winRate.toFixed(2)),
        averageScore: parseFloat(averageScore.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get my stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching statistics'
    });
  }
};

// @desc    Get class leaderboard
// @route   GET /api/student-quiz-battle/leaderboard
// @access  Private (Student only)
const getClassLeaderboard = async (req, res) => {
  try {
    const studentId = req.user._id;
    
    // Get student's class
    const Student = mongoose.model('Student');
    const student = await Student.findById(studentId).select('classId name');
    
    if (!student || !student.classId) {
      return res.status(404).json({
        success: false,
        error: 'Student class not found'
      });
    }

    // Get all students in the same class
    const classStudents = await Student.find({ 
      classId: student.classId,
      status: 'active'
    }).select('_id name email');

    // Get quiz attempts for all students in the class
    const studentIds = classStudents.map(s => s._id);
    const attempts = await StudentQuizAttempt.aggregate([
      {
        $match: {
          studentId: { $in: studentIds }
        }
      },
      {
        $group: {
          _id: '$studentId',
          totalPoints: { $sum: '$score' },
          totalCorrectAnswers: { $sum: '$correctAnswers' },
          totalQuestions: { $sum: '$totalQuestions' },
          attemptCount: { $sum: 1 }
        }
      }
    ]);

    // Create leaderboard with student details
    const leaderboard = classStudents.map(student => {
      const studentAttempts = attempts.find(a => a._id.toString() === student._id.toString());
      const totalPoints = studentAttempts ? studentAttempts.totalPoints : 0;
      const totalCorrectAnswers = studentAttempts ? studentAttempts.totalCorrectAnswers : 0;
      const totalQuestions = studentAttempts ? studentAttempts.totalQuestions : 0;
      const winRate = totalQuestions > 0 ? (totalCorrectAnswers / totalQuestions) * 100 : 0;
      
      return {
        studentId: student._id,
        name: student.name,
        totalPoints: Math.round(totalPoints),
        totalCorrectAnswers,
        totalQuestions,
        winRate: parseFloat(winRate.toFixed(2)),
        attemptCount: studentAttempts ? studentAttempts.attemptCount : 0,
        isCurrentUser: student._id.toString() === studentId.toString()
      };
    });

    // Sort by total points (descending)
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

    // Add rank to each student
    leaderboard.forEach((student, index) => {
      student.rank = index + 1;
    });

    // Find current user's position
    const currentUserData = leaderboard.find(s => s.isCurrentUser);
    const currentUserRank = currentUserData ? currentUserData.rank : null;
    const totalStudents = leaderboard.length;
    const percentile = currentUserRank && totalStudents > 0 
      ? Math.round(((totalStudents - currentUserRank) / totalStudents) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        leaderboard,
        currentUser: {
          rank: currentUserRank,
          percentile,
          totalPoints: currentUserData ? currentUserData.totalPoints : 0,
          winRate: currentUserData ? currentUserData.winRate : 0
        },
        totalStudents
      }
    });
  } catch (error) {
    console.error('Get class leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching leaderboard'
    });
  }
};

module.exports = {
  getAvailableQuizzes,
  getQuizById,
  submitQuizAttempt,
  getMyAttempts,
  getMyStats,
  getClassLeaderboard
};

