const mongoose = require('mongoose');

const courseReviewSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },
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
  userName: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Review comment cannot exceed 1000 characters']
  },
  isVerified: {
    type: Boolean,
    default: true // Verified if user completed the course
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  replies: [{
    userName: String,
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Compound index to ensure one review per user per course
courseReviewSchema.index({ courseId: 1, userId: 1 }, { unique: true });

// Static method to get average rating for a course
courseReviewSchema.statics.getAverageRating = async function(courseId) {
  const result = await this.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
    {
      $group: {
        _id: '$courseId',
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);
  
  if (result.length > 0) {
    return {
      avgRating: Math.round(result[0].avgRating * 10) / 10,
      totalReviews: result[0].totalReviews
    };
  }
  
  return { avgRating: 0, totalReviews: 0 };
};

// Static method to get rating distribution
courseReviewSchema.statics.getRatingDistribution = async function(courseId) {
  const result = await this.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  result.forEach(item => {
    distribution[item._id] = item.count;
  });
  
  return distribution;
};

module.exports = mongoose.model('CourseReview', courseReviewSchema);

