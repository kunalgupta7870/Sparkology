const mongoose = require('mongoose');

const courseProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Student', 'Parent', 'User']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  completedVideos: [{
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    watchDuration: {
      type: Number, // in seconds
      default: 0
    }
  }],
  videoPositions: [{
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    lastPosition: {
      type: Number, // in seconds
      default: 0
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now
    },
    totalWatchTime: {
      type: Number, // total time watched in seconds
      default: 0
    }
  }],
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  progress: {
    type: Number, // percentage 0-100
    default: 0,
    min: 0,
    max: 100
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for faster queries
courseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });
courseProgressSchema.index({ userModel: 1, userId: 1 });

// Method to mark video as completed
courseProgressSchema.methods.markVideoComplete = async function(videoId, watchDuration = 0) {
  // Check if video already marked complete
  const existingVideo = this.completedVideos.find(
    v => v.videoId.toString() === videoId.toString()
  );
  
  if (!existingVideo) {
    this.completedVideos.push({
      videoId,
      completedAt: new Date(),
      watchDuration
    });
  }
  
  this.lastAccessedAt = new Date();
  return this.save();
};

// Method to save video position
courseProgressSchema.methods.saveVideoPosition = async function(videoId, position, totalWatchTime = 0) {
  // Find existing position or create new one
  let videoPosition = this.videoPositions.find(
    v => v.videoId.toString() === videoId.toString()
  );
  
  if (videoPosition) {
    videoPosition.lastPosition = position;
    videoPosition.lastWatchedAt = new Date();
    videoPosition.totalWatchTime = totalWatchTime;
  } else {
    this.videoPositions.push({
      videoId,
      lastPosition: position,
      lastWatchedAt: new Date(),
      totalWatchTime
    });
  }
  
  this.lastAccessedAt = new Date();
  return this.save();
};

// Method to get video position
courseProgressSchema.methods.getVideoPosition = function(videoId) {
  const videoPosition = this.videoPositions.find(
    v => v.videoId.toString() === videoId.toString()
  );
  
  return videoPosition ? {
    lastPosition: videoPosition.lastPosition,
    lastWatchedAt: videoPosition.lastWatchedAt,
    totalWatchTime: videoPosition.totalWatchTime
  } : null;
};

// Method to calculate and update progress
courseProgressSchema.methods.updateProgress = async function() {
  const Course = mongoose.model('Course');
  const course = await Course.findById(this.courseId);
  
  if (!course || !course.videos || course.videos.length === 0) {
    this.progress = 0;
    return this.save();
  }
  
  const totalVideos = course.videos.length;
  const completedVideos = this.completedVideos.length;
  
  this.progress = Math.round((completedVideos / totalVideos) * 100);
  
  // Mark as completed if all videos are watched
  if (completedVideos >= totalVideos && !this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
  }
  
  return this.save();
};

// Static method to get or create progress
courseProgressSchema.statics.getOrCreate = async function(userId, userModel, courseId) {
  let progress = await this.findOne({ userId, courseId });
  
  if (!progress) {
    progress = await this.create({
      userId,
      userModel,
      courseId
    });
  }
  
  return progress;
};

module.exports = mongoose.model('CourseProgress', courseProgressSchema);

