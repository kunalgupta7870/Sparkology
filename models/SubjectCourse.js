const mongoose = require('mongoose');

const subjectCourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    maxlength: [200, 'Course title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  subjectName: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true,
    maxlength: [100, 'Subject name cannot exceed 100 characters']
  },
  className: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true,
    maxlength: [100, 'Class name cannot exceed 100 characters']
  },
  // Learning objectives
  learningObjectives: [{
    type: String,
    trim: true,
    maxlength: [500, 'Learning objective cannot exceed 500 characters']
  }],
  // Video content
  videos: [{
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
      maxlength: [200, 'Video title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Video description cannot exceed 1000 characters']
    },
    videoUrl: {
      type: String,
      required: [true, 'Video URL is required'],
      trim: true
    },
    thumbnail: {
      type: String,
      trim: true
    },
    duration: {
      type: Number, // in seconds
      default: 0
    },
    order: {
      type: Number,
      required: [true, 'Video order is required'],
      min: [1, 'Order must be at least 1']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    viewCount: {
      type: Number,
      default: 0
    }
  }],
  // Course thumbnail
  thumbnail: {
    type: String,
    trim: true
  },
  // Course notes (PDFs)
  notes: [{
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: [200, 'Note title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Note description cannot exceed 500 characters']
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true
    },
    fileSize: {
      type: Number, // in bytes
      default: 0
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    order: {
      type: Number,
      default: 1
    }
  }],
  // Quizzes - array of separate quizzes
  quizzes: [{
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true,
      maxlength: [200, 'Quiz title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Quiz description cannot exceed 500 characters']
    },
    timeLimit: {
      type: Number, // in minutes
      default: 30,
      min: [1, 'Time limit must be at least 1 minute']
    },
    passingScore: {
      type: Number, // percentage (0-100)
      default: 60,
      min: [0, 'Passing score must be at least 0'],
      max: [100, 'Passing score cannot exceed 100']
    },
    questions: [{
      question: {
        type: String,
        required: [true, 'Question is required'],
        trim: true,
        maxlength: [500, 'Question cannot exceed 500 characters']
      },
      options: {
        type: [{
          type: String,
          required: true,
          trim: true,
          maxlength: [200, 'Option cannot exceed 200 characters']
        }],
        validate: {
          validator: function(v) {
            return v && v.length === 4;
          },
          message: 'Exactly 4 options are required'
        }
      },
      correctAnswer: {
        type: Number,
        required: [true, 'Correct answer index is required'],
        min: [0, 'Answer index must be at least 0'],
        max: [3, 'Answer index must be at most 3']
      },
      explanation: {
        type: String,
        trim: true,
        maxlength: [500, 'Explanation cannot exceed 500 characters']
      },
      difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
      },
      order: {
        type: Number,
        default: 1
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Legacy fields for backward compatibility
  quizMetadata: {
    title: String,
    timeLimit: Number,
    passingScore: Number,
    description: String
  },
  quizQuestions: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String,
    difficulty: String,
    order: Number
  }],
  // Metadata
  totalDuration: {
    type: Number, // total duration in seconds
    default: 0
  },
  videoCount: {
    type: Number,
    default: 0
  },
  notesCount: {
    type: Number,
    default: 0
  },
  quizCount: {
    type: Number,
    default: 0
  },
  quizzesCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
subjectCourseSchema.index({ subjectName: 1 });
subjectCourseSchema.index({ className: 1 });
subjectCourseSchema.index({ title: 1 });
subjectCourseSchema.index({ createdBy: 1 });

// Pre-save middleware to update counts and totals
subjectCourseSchema.pre('save', function(next) {
  // Update video count
  this.videoCount = this.videos.length;
  
  // Update total duration
  this.totalDuration = this.videos.reduce((total, video) => total + (video.duration || 0), 0);
  
  // Update notes count
  this.notesCount = this.notes.length;
  
  // Update quiz count (legacy - total questions across all quizzes)
  this.quizCount = this.quizQuestions.length;
  
  // Update quizzes count (new - number of separate quizzes)
  this.quizzesCount = this.quizzes.length;
  
  next();
});

// Static method to get courses by subject name
subjectCourseSchema.statics.getCoursesBySubject = function(subjectName) {
  return this.find({ subjectName })
    .populate('createdBy', 'name email');
};

// Static method to get courses by class name
subjectCourseSchema.statics.getCoursesByClass = function(className) {
  return this.find({ className })
    .populate('createdBy', 'name email');
};

// Static method to search courses
subjectCourseSchema.statics.searchCourses = function(query, filters = {}) {
  const searchQuery = {
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { subjectName: { $regex: query, $options: 'i' } },
      { className: { $regex: query, $options: 'i' } }
    ],
    ...filters
  };
  
  return this.find(searchQuery)
    .populate('createdBy', 'name email');
};

// Instance method to add a video to the course
subjectCourseSchema.methods.addVideo = function(videoData) {
  this.videos.push(videoData);
  return this.save();
};

// Instance method to remove a video from the course
subjectCourseSchema.methods.removeVideo = function(videoId) {
  this.videos = this.videos.filter(video => video._id.toString() !== videoId);
  return this.save();
};

// Instance method to update video order
subjectCourseSchema.methods.updateVideoOrder = function(videoId, newOrder) {
  const video = this.videos.id(videoId);
  if (video) {
    video.order = newOrder;
    // Sort videos by order
    this.videos.sort((a, b) => a.order - b.order);
    return this.save();
  }
  throw new Error('Video not found');
};

// Instance method to get videos sorted by order
subjectCourseSchema.methods.getVideosSorted = function() {
  return this.videos.sort((a, b) => a.order - b.order);
};

// Instance method to add a note
subjectCourseSchema.methods.addNote = function(noteData) {
  this.notes.push(noteData);
  return this.save();
};

// Instance method to remove a note
subjectCourseSchema.methods.removeNote = function(noteId) {
  this.notes = this.notes.filter(note => note._id.toString() !== noteId);
  return this.save();
};

// Instance method to add a quiz question
subjectCourseSchema.methods.addQuizQuestion = function(questionData) {
  this.quizQuestions.push(questionData);
  return this.save();
};

// Instance method to remove a quiz question
subjectCourseSchema.methods.removeQuizQuestion = function(questionId) {
  this.quizQuestions = this.quizQuestions.filter(q => q._id.toString() !== questionId);
  return this.save();
};

// Instance method to update a quiz question
subjectCourseSchema.methods.updateQuizQuestion = function(questionId, questionData) {
  const question = this.quizQuestions.id(questionId);
  if (question) {
    Object.assign(question, questionData);
    return this.save();
  }
  throw new Error('Quiz question not found');
};

// Instance method to update quiz metadata
subjectCourseSchema.methods.updateQuizMetadata = function(metadata) {
  if (!this.quizMetadata) {
    this.quizMetadata = {};
  }
  Object.assign(this.quizMetadata, metadata);
  return this.save();
};

// Instance method to add multiple quiz questions at once
subjectCourseSchema.methods.addMultipleQuizQuestions = function(questionsArray) {
  questionsArray.forEach((questionData, index) => {
    const order = questionData.order || this.quizQuestions.length + index + 1;
    this.quizQuestions.push({ ...questionData, order });
  });
  return this.save();
};

// Instance method to add a new quiz
subjectCourseSchema.methods.addQuiz = function(quizData) {
  this.quizzes.push(quizData);
  return this.save();
};

// Instance method to remove a quiz
subjectCourseSchema.methods.removeQuiz = function(quizId) {
  this.quizzes = this.quizzes.filter(quiz => quiz._id.toString() !== quizId);
  return this.save();
};

// Instance method to get a specific quiz
subjectCourseSchema.methods.getQuizById = function(quizId) {
  return this.quizzes.id(quizId);
};

module.exports = mongoose.model('SubjectCourse', subjectCourseSchema);

