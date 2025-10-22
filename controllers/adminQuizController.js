const mongoose = require('mongoose');

// Simple in-memory schema for admin quizzes (you can create a model later if needed)
// For now, we'll use a simple collection
const AdminQuiz = mongoose.model('AdminQuiz', new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Quiz name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  timeRequired: {
    type: Number, // in minutes
    required: [true, 'Time required is required'],
    min: [1, 'Time must be at least 1 minute']
  },
  questions: [{
    questionText: {
      type: String,
      required: true,
      trim: true
    },
    questionType: {
      type: String,
      enum: ['multiple-choice', 'true-false', 'short-answer'],
      default: 'multiple-choice'
    },
    options: [{
      text: String,
      isCorrect: Boolean
    }],
    correctAnswer: String, // For short-answer
    marks: {
      type: Number,
      default: 1
    }
  }],
  totalMarks: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true }));

// @desc    Get all admin quizzes
// @route   GET /api/admin-quizzes
// @access  Private (Admin only)
const getAdminQuizzes = async (req, res) => {
  try {
    const { status, search } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const quizzes = await AdminQuiz.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: quizzes.length,
      data: quizzes
    });
  } catch (error) {
    console.error('Get admin quizzes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quizzes'
    });
  }
};

// @desc    Get single admin quiz
// @route   GET /api/admin-quizzes/:id
// @access  Private (Admin only)
const getAdminQuiz = async (req, res) => {
  try {
    const quiz = await AdminQuiz.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: quiz
    });
  } catch (error) {
    console.error('Get admin quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching quiz'
    });
  }
};

// @desc    Create new admin quiz
// @route   POST /api/admin-quizzes
// @access  Private (Admin only)
const createAdminQuiz = async (req, res) => {
  try {
    const { name, description, timeRequired, questions, status } = req.body;
    
    // Validate
    if (!name || !timeRequired) {
      return res.status(400).json({
        success: false,
        error: 'Name and time required are mandatory'
      });
    }
    
    if (!questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one question is required'
      });
    }
    
    // Calculate total marks
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    
    const quiz = await AdminQuiz.create({
      name,
      description,
      timeRequired,
      questions,
      totalMarks,
      status: status || 'active',
      createdBy: req.user._id
    });
    
    await quiz.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      data: quiz
    });
  } catch (error) {
    console.error('Create admin quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating quiz'
    });
  }
};

// @desc    Update admin quiz
// @route   PUT /api/admin-quizzes/:id
// @access  Private (Admin only)
const updateAdminQuiz = async (req, res) => {
  try {
    const quiz = await AdminQuiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }
    
    const { name, description, timeRequired, questions, status } = req.body;
    
    // Update fields
    if (name) quiz.name = name;
    if (description !== undefined) quiz.description = description;
    if (timeRequired) quiz.timeRequired = timeRequired;
    if (questions) {
      quiz.questions = questions;
      quiz.totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    }
    if (status) quiz.status = status;
    quiz.updatedAt = Date.now();
    
    await quiz.save();
    await quiz.populate('createdBy', 'name email');
    
    res.status(200).json({
      success: true,
      message: 'Quiz updated successfully',
      data: quiz
    });
  } catch (error) {
    console.error('Update admin quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating quiz'
    });
  }
};

// @desc    Delete admin quiz
// @route   DELETE /api/admin-quizzes/:id
// @access  Private (Admin only)
const deleteAdminQuiz = async (req, res) => {
  try {
    const quiz = await AdminQuiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }
    
    await AdminQuiz.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Delete admin quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting quiz'
    });
  }
};

module.exports = {
  getAdminQuizzes,
  getAdminQuiz,
  createAdminQuiz,
  updateAdminQuiz,
  deleteAdminQuiz
};

