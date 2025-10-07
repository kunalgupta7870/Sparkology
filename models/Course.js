const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Course name is required'],
    trim: true,
    maxlength: [200, 'Course name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  instructor: {
    type: String,
    required: [true, 'Instructor name is required'],
    trim: true,
    maxlength: [100, 'Instructor name cannot exceed 100 characters']
  },
  students: {
    type: Number,
    default: 0,
    min: [0, 'Student count cannot be negative']
  },
  duration: {
    type: String,
    required: [true, 'Course duration is required'],
    trim: true,
    maxlength: [50, 'Duration cannot exceed 50 characters']
  },
  status: {
    type: String,
    enum: ['active', 'draft', 'completed', 'cancelled'],
    default: 'draft',
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: false // Optional - admin users don't have schoolId
  },
  category: {
    type: String,
    default: 'general',
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD',
    maxlength: [3, 'Currency code cannot exceed 3 characters']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  maxStudents: {
    type: Number,
    default: 30,
    min: [1, 'Maximum students must be at least 1']
  },
  prerequisites: [{
    type: String,
    trim: true
  }],
  learningObjectives: [{
    type: String,
    trim: true,
    maxlength: [200, 'Learning objective cannot exceed 200 characters']
  }],
  syllabus: [{
    week: {
      type: Number,
      required: true
    },
    topic: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  }],
  resources: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['document', 'video', 'link', 'assignment'],
      required: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  }],
  assessments: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['quiz', 'assignment', 'exam', 'project'],
      required: true
    },
    weight: {
      type: Number,
      required: true,
      min: [0, 'Weight cannot be negative'],
      max: [100, 'Weight cannot exceed 100']
    },
    dueDate: {
      type: Date,
      required: true
    },
    description: {
      type: String,
      trim: true
    }
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  enrollmentOpen: {
    type: Boolean,
    default: true
  },
  // Video lessons for the course
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
    isPublished: {
      type: Boolean,
      default: true
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
  // Additional course metadata
  totalDuration: {
    type: Number, // total duration in seconds
    default: 0
  },
  videoCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
courseSchema.index({ name: 1 });
courseSchema.index({ schoolId: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ tags: 1 });

// Virtual for enrollment status
courseSchema.virtual('enrollmentStatus').get(function() {
  if (!this.enrollmentOpen) return 'closed';
  if (this.students >= this.maxStudents) return 'full';
  if (this.status !== 'active') return 'inactive';
  return 'open';
});

// Virtual for completion percentage
courseSchema.virtual('completionPercentage').get(function() {
  if (!this.endDate) return 0;
  const now = new Date();
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  
  if (now < start) return 0;
  if (now > end) return 100;
  
  const totalDuration = end - start;
  const elapsed = now - start;
  return Math.round((elapsed / totalDuration) * 100);
});

// Pre-save middleware to validate dates
courseSchema.pre('save', function(next) {
  if (this.endDate && this.endDate <= this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

// Static method to get courses by school
courseSchema.statics.getCoursesBySchool = function(schoolId) {
  return this.find({ schoolId }).populate('schoolId', 'name code');
};

// Static method to get active courses
courseSchema.statics.getActiveCourses = function() {
  return this.find({ status: 'active' }).populate('schoolId', 'name code');
};

// Static method to get courses by instructor
courseSchema.statics.getCoursesByInstructor = function(instructor) {
  return this.find({ instructor }).populate('schoolId', 'name code');
};

// Static method to search courses
courseSchema.statics.searchCourses = function(query, filters = {}) {
  const searchQuery = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { instructor: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ],
    ...filters
  };
  
  return this.find(searchQuery).populate('schoolId', 'name code');
};

// Instance method to check if course can accept more students
courseSchema.methods.canAcceptStudents = function(count = 1) {
  return (this.students + count) <= this.maxStudents && this.enrollmentOpen;
};

// Instance method to enroll students
courseSchema.methods.enrollStudents = function(count) {
  if (this.canAcceptStudents(count)) {
    this.students += count;
    return this.save();
  }
  throw new Error('Cannot enroll more students. Course is full or enrollment is closed.');
};

// Instance method to unenroll students
courseSchema.methods.unenrollStudents = function(count) {
  if (this.students >= count) {
    this.students -= count;
    return this.save();
  }
  throw new Error('Cannot unenroll more students than currently enrolled.');
};

// Instance method to add a video to the course
courseSchema.methods.addVideo = function(videoData) {
  this.videos.push(videoData);
  this.videoCount = this.videos.length;
  this.totalDuration = this.videos.reduce((total, video) => total + (video.duration || 0), 0);
  return this.save();
};

// Instance method to remove a video from the course
courseSchema.methods.removeVideo = function(videoId) {
  this.videos = this.videos.filter(video => video._id.toString() !== videoId);
  this.videoCount = this.videos.length;
  this.totalDuration = this.videos.reduce((total, video) => total + (video.duration || 0), 0);
  return this.save();
};

// Instance method to update video order
courseSchema.methods.updateVideoOrder = function(videoId, newOrder) {
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
courseSchema.methods.getVideosSorted = function() {
  return this.videos.sort((a, b) => a.order - b.order);
};

// Instance method to get published videos only
courseSchema.methods.getPublishedVideos = function() {
  return this.videos.filter(video => video.isPublished).sort((a, b) => a.order - b.order);
};

module.exports = mongoose.model('Course', courseSchema);
