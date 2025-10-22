const mongoose = require('mongoose');

const studentQuizAttemptSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student is required']
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminQuiz',
    required: [true, 'Quiz is required']
  },
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    selectedAnswer: {
      type: String,
      required: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    },
    marksAwarded: {
      type: Number,
      default: 0
    }
  }],
  score: {
    type: Number,
    required: true,
    default: 0
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    required: true,
    default: 0
  },
  percentage: {
    type: Number,
    required: true,
    default: 0
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
studentQuizAttemptSchema.index({ studentId: 1, completedAt: -1 });
studentQuizAttemptSchema.index({ quizId: 1 });

module.exports = mongoose.model('StudentQuizAttempt', studentQuizAttemptSchema);

