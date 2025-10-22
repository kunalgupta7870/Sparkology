const SubjectCourseProgress = require('../models/SubjectCourseProgress');
const SubjectCourse = require('../models/SubjectCourse');

// @desc    Get subject course progress for current user
// @route   GET /api/subject-courses/:subjectCourseId/progress
// @access  Private
exports.getSubjectCourseProgress = async (req, res) => {
  try {
    const { subjectCourseId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`📊 Getting progress for subject course ${subjectCourseId}, user ${userId}`);
    
    let progress = await SubjectCourseProgress.findOne({ userId, subjectCourseId });
    
    if (!progress) {
      // Create new progress if doesn't exist
      progress = await SubjectCourseProgress.create({
        userId,
        userModel,
        subjectCourseId
      });
      console.log('📊 Created new subject course progress record');
    }
    
    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error getting subject course progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subject course progress',
      message: error.message
    });
  }
};

// @desc    Mark video as completed
// @route   POST /api/subject-courses/:subjectCourseId/progress/video/:videoId
// @access  Private
exports.markVideoComplete = async (req, res) => {
  try {
    const { subjectCourseId, videoId } = req.params;
    const { watchDuration } = req.body;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`✅ Marking video ${videoId} complete for subject course ${subjectCourseId}, user ${userId}`);
    
    // Get or create progress
    let progress = await SubjectCourseProgress.getOrCreate(userId, userModel, subjectCourseId);
    
    // Mark video complete
    await progress.markVideoComplete(videoId, watchDuration);
    
    // Update overall progress
    await progress.updateProgress();
    
    // Reload progress to get updated data
    progress = await SubjectCourseProgress.findById(progress._id);
    
    console.log(`✅ Video marked complete. Progress: ${progress.progress}%, Completed: ${progress.isCompleted}`);
    
    res.status(200).json({
      success: true,
      data: progress,
      message: progress.isCompleted ? 'Congratulations! You completed the subject course!' : 'Video marked as complete'
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
// @route   POST /api/subject-courses/:subjectCourseId/progress/video/:videoId/position
// @access  Private
exports.saveVideoPosition = async (req, res) => {
  try {
    const { subjectCourseId, videoId } = req.params;
    const { position, totalWatchTime } = req.body;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`📍 Saving video position for video ${videoId}, subject course ${subjectCourseId}, user ${userId}`);
    console.log(`📍 Position: ${position}s, Total watch time: ${totalWatchTime}s`);
    
    // Get or create progress
    let progress = await SubjectCourseProgress.getOrCreate(userId, userModel, subjectCourseId);
    
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
// @route   GET /api/subject-courses/:subjectCourseId/progress/video/:videoId/position
// @access  Private
exports.getVideoPosition = async (req, res) => {
  try {
    const { subjectCourseId, videoId } = req.params;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : req.user.role === 'parent' ? 'Parent' : 'User';
    
    console.log(`📍 Getting video position for video ${videoId}, subject course ${subjectCourseId}, user ${userId}`);
    
    // Get progress
    let progress = await SubjectCourseProgress.findOne({ userId, subjectCourseId });
    
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

// @desc    Get all completed subject courses for current user
// @route   GET /api/subject-courses/progress/completed
// @access  Private
exports.getCompletedSubjectCourses = async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log(`📚 Getting completed subject courses for user ${userId}`);
    
    const completedCourses = await SubjectCourseProgress.find({
      userId,
      isCompleted: true
    }).populate('subjectCourseId', 'title description thumbnail totalDuration');
    
    res.status(200).json({
      success: true,
      data: completedCourses
    });
  } catch (error) {
    console.error('Error getting completed subject courses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get completed subject courses',
      message: error.message
    });
  }
};
