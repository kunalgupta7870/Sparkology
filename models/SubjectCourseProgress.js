const mongoose = require('mongoose');

const subjectCourseProgressSchema = new mongoose.Schema({
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
  subjectCourseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectCourse',
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
subjectCourseProgressSchema.index({ userId: 1, subjectCourseId: 1 }, { unique: true });
subjectCourseProgressSchema.index({ userModel: 1, userId: 1 });

// Method to mark video as completed
subjectCourseProgressSchema.methods.markVideoComplete = async function(videoId, watchDuration = 0) {
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
subjectCourseProgressSchema.methods.saveVideoPosition = async function(videoId, position, totalWatchTime = 0) {
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
subjectCourseProgressSchema.methods.getVideoPosition = function(videoId) {
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
subjectCourseProgressSchema.methods.updateProgress = async function() {
  const SubjectCourse = mongoose.model('SubjectCourse');
  const subjectCourse = await SubjectCourse.findById(this.subjectCourseId);
  
  if (!subjectCourse || !subjectCourse.videos || subjectCourse.videos.length === 0) {
    this.progress = 0;
    return this.save();
  }
  
  const totalVideos = subjectCourse.videos.length;
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
subjectCourseProgressSchema.statics.getOrCreate = async function(userId, userModel, subjectCourseId) {
  let progress = await this.findOne({ userId, subjectCourseId });
  
  if (!progress) {
    progress = await this.create({
      userId,
      userModel,
      subjectCourseId
    });
  }
  
  return progress;
};

module.exports = mongoose.model('SubjectCourseProgress', subjectCourseProgressSchema);
