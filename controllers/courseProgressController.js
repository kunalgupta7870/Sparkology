const CourseProgress = require('../models/CourseProgress');
const Course = require('../models/Course');

// @desc    Get course progress for current user
// @route   GET /api/courses/:courseId/progress
// @access  Private
exports.getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`📊 Getting progress for course ${courseId}, user ${userId}`);
    
    let progress = await CourseProgress.findOne({ userId, courseId });
    
    if (!progress) {
      // Create new progress if doesn't exist
      progress = await CourseProgress.create({
        userId,
        userModel,
        courseId
      });
      console.log('📊 Created new progress record');
    }
    
    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error getting course progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get course progress',
      message: error.message
    });
  }
};

// @desc    Mark video as completed
// @route   POST /api/courses/:courseId/progress/video/:videoId
// @access  Private
exports.markVideoComplete = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { watchDuration } = req.body;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`✅ Marking video ${videoId} complete for course ${courseId}, user ${userId}`);
    
    // Get or create progress
    let progress = await CourseProgress.getOrCreate(userId, userModel, courseId);
    
    // Mark video complete
    await progress.markVideoComplete(videoId, watchDuration);
    
    // Update overall progress
    await progress.updateProgress();
    
    // Reload progress to get updated data
    progress = await CourseProgress.findById(progress._id);
    
    console.log(`✅ Video marked complete. Progress: ${progress.progress}%, Completed: ${progress.isCompleted}`);
    
    res.status(200).json({
      success: true,
      data: progress,
      message: progress.isCompleted ? 'Congratulations! You completed the course!' : 'Video marked as complete'
    });
  } catch (error) {
    console.error('Error marking video complete:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark video complete',
      message: error.message
    });
  }
};

// @desc    Save video position
// @route   POST /api/courses/:courseId/progress/video/:videoId/position
// @access  Private
exports.saveVideoPosition = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { position, totalWatchTime } = req.body;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`📍 Saving video position for video ${videoId}, course ${courseId}, user ${userId}`);
    console.log(`📍 Position: ${position}s, Total watch time: ${totalWatchTime}s`);
    
    // Get or create progress
    let progress = await CourseProgress.getOrCreate(userId, userModel, courseId);
    
    // Save video position
    await progress.saveVideoPosition(videoId, position, totalWatchTime);
    
    console.log(`📍 Video position saved successfully`);
    
    res.status(200).json({
      success: true,
      message: 'Video position saved successfully',
      data: {
        videoId,
        position,
        totalWatchTime
      }
    });
  } catch (error) {
    console.error('Error saving video position:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save video position',
      message: error.message
    });
  }
};

// @desc    Get video position
// @route   GET /api/courses/:courseId/progress/video/:videoId/position
// @access  Private
exports.getVideoPosition = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`📍 Getting video position for video ${videoId}, course ${courseId}, user ${userId}`);
    
    // Get progress
    let progress = await CourseProgress.findOne({ userId, courseId });
    
    if (!progress) {
      return res.status(200).json({
        success: true,
        data: {
          lastPosition: 0,
          totalWatchTime: 0,
          lastWatchedAt: null
        }
      });
    }
    
    const videoPosition = progress.getVideoPosition(videoId);
    
    console.log(`📍 Video position retrieved:`, videoPosition);
    
    res.status(200).json({
      success: true,
      data: videoPosition || {
        lastPosition: 0,
        totalWatchTime: 0,
        lastWatchedAt: null
      }
    });
  } catch (error) {
    console.error('Error getting video position:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video position',
      message: error.message
    });
  }
};

// @desc    Get all completed courses for current user
// @route   GET /api/courses/progress/completed
// @access  Private
exports.getCompletedCourses = async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log(`📚 Getting completed courses for user ${userId}`);
    
    const completedCourses = await CourseProgress.find({
      userId,
      isCompleted: true
    }).populate('courseId', 'name instructor thumbnail category price');
    
    res.status(200).json({
      success: true,
      data: completedCourses
    });
  } catch (error) {
    console.error('Error getting completed courses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get completed courses',
      message: error.message
    });
  }
};

module.exports = exports;

