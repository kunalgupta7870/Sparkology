const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [1000, 'Question text cannot exceed 1000 characters']
  },
  questionType: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    default: 'multiple-choice'
  },
  options: [{
    text: {
      type: String,
      trim: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    }
  }],
  correctAnswer: {
    type: String, // For short-answer questions
    trim: true
  },
  marks: {
    type: Number,
    required: [true, 'Question marks are required'],
    min: [0, 'Marks cannot be negative']
  },
  explanation: {
    type: String,
    trim: true,
    maxlength: [500, 'Explanation cannot exceed 500 characters']
  }
});

const quizSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Quiz name is required'],
    trim: true,
    maxlength: [200, 'Quiz name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject is required']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher is required']
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School is required']
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function(questions) {
        return questions && questions.length > 0;
      },
      message: 'Quiz must have at least one question'
    }
  },
  duration: {
    type: Number, // Duration in minutes
    required: [true, 'Quiz duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  passingMarks: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  allowLateSubmission: {
    type: Boolean,
    default: false
  },
  shuffleQuestions: {
    type: Boolean,
    default: false
  },
  showCorrectAnswers: {
    type: Boolean,
    default: true // Show correct answers after submission
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  submissions: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    answers: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId
      },
      selectedAnswer: {
        type: String // For multiple-choice: option text, for short-answer: student's answer
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
    startedAt: {
      type: Date
    },
    submittedAt: {
      type: Date
    },
    totalMarks: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    passed: {
      type: Boolean,
      default: false
    },
    timeTaken: {
      type: Number, // Time taken in minutes
      default: 0
    },
    status: {
      type: String,
      enum: ['in-progress', 'submitted', 'late', 'graded'],
      default: 'in-progress'
    },
    feedback: {
      type: String,
      trim: true
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
quizSchema.index({ schoolId: 1, classId: 1 });
quizSchema.index({ teacherId: 1, startDate: 1 });
quizSchema.index({ classId: 1, status: 1 });
quizSchema.index({ startDate: 1, endDate: 1 });

// Virtual for submission count
quizSchema.virtual('submissionCount').get(function() {
  return this.submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length;
});

// Virtual for average score
quizSchema.virtual('averageScore').get(function() {
  const completedSubmissions = this.submissions.filter(s => s.status === 'submitted' || s.status === 'graded');
  if (completedSubmissions.length === 0) return 0;
  
  const totalScore = completedSubmissions.reduce((sum, sub) => sum + sub.totalMarks, 0);
  return (totalScore / completedSubmissions.length).toFixed(2);
});

// Pre-save middleware to calculate total marks
quizSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalMarks = this.questions.reduce((sum, question) => sum + question.marks, 0);
  }
  next();
});

// Pre-save validation: ensure endDate is after startDate
quizSchema.pre('save', function(next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  }
  next();
});

// Static method to get quizzes by teacher
quizSchema.statics.getQuizzesByTeacher = function(teacherId, options = {}) {
  const { status, startDate, endDate } = options;
  const query = { teacherId };
  
  if (status) query.status = status;
  if (startDate || endDate) {
    query.startDate = {};
    if (startDate) query.startDate.$gte = new Date(startDate);
    if (endDate) query.startDate.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('schoolId', 'name')
    .sort({ startDate: -1 });
};

// Static method to get quizzes by class
quizSchema.statics.getQuizzesByClass = function(classId, options = {}) {
  const { status, startDate, endDate } = options;
  const query = { classId };
  
  if (status) query.status = status;
  if (startDate || endDate) {
    query.startDate = {};
    if (startDate) query.startDate.$gte = new Date(startDate);
    if (endDate) query.startDate.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('teacherId', 'name email')
    .populate('subjectId', 'name code')
    .sort({ startDate: -1 });
};

// Instance method to start quiz for student
quizSchema.methods.startQuiz = async function(studentId) {
  // Check if student already has a submission
  const existingSubmission = this.submissions.find(
    s => s.studentId.toString() === studentId.toString()
  );
  
  if (existingSubmission) {
    throw new Error('Quiz already started or submitted');
  }
  
  // Check if quiz is active and within time range
  const now = new Date();
  if (this.status !== 'active') {
    throw new Error('Quiz is not active');
  }
  
  if (now < this.startDate) {
    throw new Error('Quiz has not started yet');
  }
  
  if (now > this.endDate && !this.allowLateSubmission) {
    throw new Error('Quiz has ended');
  }
  
  // Create new submission
  this.submissions.push({
    studentId,
    startedAt: now,
    status: 'in-progress',
    answers: []
  });
  
  return this.save();
};

// Instance method to submit quiz
quizSchema.methods.submitQuiz = async function(studentId, answers) {
  const submission = this.submissions.find(
    s => s.studentId.toString() === studentId.toString()
  );
  
  if (!submission) {
    throw new Error('Quiz not started. Please start the quiz first.');
  }
  
  if (submission.status !== 'in-progress') {
    throw new Error('Quiz already submitted');
  }
  
  const now = new Date();
  const timeTaken = Math.round((now - submission.startedAt) / (1000 * 60)); // in minutes
  
  // Check if submission is late
  const isLate = now > this.endDate;
  
  // Grade the quiz automatically
  let totalMarksObtained = 0;
  
  submission.answers = answers.map(answer => {
    const question = this.questions.id(answer.questionId);
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
      // Find the correct option
      const selectedOption = question.options.find(opt => opt.text === answer.selectedAnswer);
      isCorrect = selectedOption ? selectedOption.isCorrect : false;
      marksAwarded = isCorrect ? question.marks : 0;
    } else if (question.questionType === 'short-answer') {
      // For short-answer, exact match (case-insensitive)
      isCorrect = answer.selectedAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
      marksAwarded = isCorrect ? question.marks : 0;
    }
    
    totalMarksObtained += marksAwarded;
    
    return {
      questionId: answer.questionId,
      selectedAnswer: answer.selectedAnswer,
      isCorrect,
      marksAwarded
    };
  });
  
  submission.submittedAt = now;
  submission.totalMarks = totalMarksObtained;
  submission.percentage = (totalMarksObtained / this.totalMarks) * 100;
  submission.passed = totalMarksObtained >= this.passingMarks;
  submission.timeTaken = timeTaken;
  submission.status = isLate ? 'late' : 'graded';
  
  return this.save();
};

// Instance method to get student's submission
quizSchema.methods.getStudentSubmission = function(studentId) {
  return this.submissions.find(
    s => s.studentId.toString() === studentId.toString()
  );
};

module.exports = mongoose.model('Quiz', quizSchema);






