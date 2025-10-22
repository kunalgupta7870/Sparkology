const CourseReview = require('../models/CourseReview');
const CourseProgress = require('../models/CourseProgress');
const Course = require('../models/Course');

// @desc    Get reviews for a course
// @route   GET /api/courses/:courseId/reviews
// @access  Public
exports.getCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { limit = 10, skip = 0 } = req.query;
    
    console.log(`📝 Getting reviews for course ${courseId}`);
    
    const reviews = await CourseReview.find({ courseId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await CourseReview.countDocuments({ courseId });
    const avgRating = await CourseReview.getAverageRating(courseId);
    const distribution = await CourseReview.getRatingDistribution(courseId);
    
    res.status(200).json({
      success: true,
      data: {
        reviews,
        total,
        avgRating: avgRating.avgRating,
        totalReviews: avgRating.totalReviews,
        distribution
      }
    });
  } catch (error) {
    console.error('Error getting course reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get course reviews',
      message: error.message
    });
  }
};

// @desc    Create a review for a course
// @route   POST /api/courses/:courseId/reviews
// @access  Private (Must have completed course)
exports.createCourseReview = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;
    const userName = req.user.name;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`📝 Creating review for course ${courseId} by user ${userId}`);
    
    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: 'Course not found'
      });
    }
    
    // Check if user has completed the course
    const progress = await CourseProgress.findOne({ userId, courseId });
    
    if (!progress || !progress.isCompleted) {
      return res.status(403).json({
        success: false,
        error: 'You must complete the course before leaving a review'
      });
    }
    
    // Check if user already reviewed this course
    const existingReview = await CourseReview.findOne({ courseId, userId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this course'
      });
    }
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }
    
    // Validate comment
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Review comment is required'
      });
    }
    
    // Create review
    const review = await CourseReview.create({
      courseId,
      userId,
      userModel,
      userName,
      rating,
      comment: comment.trim(),
      isVerified: true
    });
    
    console.log(`✅ Review created successfully for course ${courseId}`);
    
    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted successfully'
    });
  } catch (error) {
    console.error('Error creating course review:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this course'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create review',
      message: error.message
    });
  }
};

// @desc    Update a review
// @route   PUT /api/courses/:courseId/reviews/:reviewId
// @access  Private (Own review only)
exports.updateCourseReview = async (req, res) => {
  try {
    const { courseId, reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;
    
    console.log(`📝 Updating review ${reviewId} for course ${courseId}`);
    
    const review = await CourseReview.findOne({ _id: reviewId, courseId, userId });
    
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found or you do not have permission to update it'
      });
    }
    
    if (rating) review.rating = rating;
    if (comment) review.comment = comment.trim();
    
    await review.save();
    
    res.status(200).json({
      success: true,
      data: review,
      message: 'Review updated successfully'
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update review',
      message: error.message
    });
  }
};

// @desc    Delete a review
// @route   DELETE /api/courses/:courseId/reviews/:reviewId
// @access  Private (Own review only or Admin)
exports.deleteCourseReview = async (req, res) => {
  try {
    const { courseId, reviewId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';
    
    console.log(`🗑️ Deleting review ${reviewId} for course ${courseId}`);
    
    const query = { _id: reviewId, courseId };
    if (!isAdmin) {
      query.userId = userId;
    }
    
    const review = await CourseReview.findOneAndDelete(query);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found or you do not have permission to delete it'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete review',
      message: error.message
    });
  }
};

// @desc    Mark review as helpful
// @route   POST /api/courses/:courseId/reviews/:reviewId/helpful
// @access  Private
exports.markReviewHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    const review = await CourseReview.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }
    
    review.helpfulCount += 1;
    await review.save();
    
    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error marking review helpful:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark review as helpful',
      message: error.message
    });
  }
};

module.exports = exports;

