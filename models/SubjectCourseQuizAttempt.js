const mongoose = require('mongoose');

const subjectCourseQuizAttemptSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  subjectCourseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectCourse',
    required: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    selectedAnswer: {
      type: Number,
      required: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  }],
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    required: true
  },
  timeSpent: {
    type: Number, // in seconds
    required: true
  },
  passed: {
    type: Boolean,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
subjectCourseQuizAttemptSchema.index({ studentId: 1, subjectCourseId: 1, quizId: 1 });
subjectCourseQuizAttemptSchema.index({ subjectCourseId: 1 });
subjectCourseQuizAttemptSchema.index({ completedAt: -1 });

// Static method to check if student has completed specific quiz
subjectCourseQuizAttemptSchema.statics.hasStudentCompleted = async function(studentId, subjectCourseId, quizId) {
  const attempt = await this.findOne({ 
    studentId, 
    subjectCourseId,
    quizId
  });
  return !!attempt;
};

// Static method to get student's attempt for specific quiz
subjectCourseQuizAttemptSchema.statics.getStudentAttempt = function(studentId, subjectCourseId, quizId) {
  return this.findOne({ 
    studentId, 
    subjectCourseId,
    quizId
  }).sort({ completedAt: -1 });
};

// Static method to get all student's attempts for a course
subjectCourseQuizAttemptSchema.statics.getStudentCourseAttempts = function(studentId, subjectCourseId) {
  return this.find({ 
    studentId, 
    subjectCourseId
  }).sort({ completedAt: -1 });
};

module.exports = mongoose.model('SubjectCourseQuizAttempt', subjectCourseQuizAttemptSchema);

