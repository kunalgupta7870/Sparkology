const Course = require('../models/Course');
const { uploadToCloudinary } = require('../utils/cloudinary');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private (Admin)
const getCourses = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, instructor } = req.query;
    const user = req.user;

    let query = {};

    // If user is not admin, show courses from their school OR courses without schoolId (admin-created global courses)
    if (user.role !== 'admin') {
      query.$or = [
        { schoolId: user.schoolId || user.school_id },
        { schoolId: { $exists: false } }, // Admin-created global courses
        { schoolId: null } // Admin-created global courses
      ];
    }

    // Add filters
    if (status) query.status = status;
    if (category) query.category = category;
    if (instructor) query.instructor = { $regex: instructor, $options: 'i' };

    const courses = await Course.find(query)
      .populate('schoolId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Course.countDocuments(query);

    res.json({
      success: true,
      data: courses,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
});

// @desc    Get course by ID
// @route   GET /api/courses/:id
// @access  Private (Admin)
const getCourse = asyncHandler(async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('schoolId', 'name');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to this course
    const user = req.user;
    // Allow access if: 1) user is admin, 2) course has no schoolId (global), 3) course belongs to user's school
    const hasAccess = user.role === 'admin' || 
                     !course.schoolId || 
                     course.schoolId.toString() === (user.schoolId || user.school_id)?.toString();
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course',
      error: error.message
    });
  }
});

// @desc    Create course
// @route   POST /api/courses
// @access  Private (Admin)
const createCourse = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    const courseData = {
      ...req.body
    };
    
    // Only add schoolId if user has one (admin users don't have schoolId)
    if (user.schoolId || user.school_id) {
      courseData.schoolId = user.schoolId || user.school_id;
    }

    const course = await Course.create(courseData);

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course',
      error: error.message
    });
  }
});

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private (Admin)
const updateCourse = asyncHandler(async (req, res) => {
  try {
    const user = req.user;

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to this course
    if (user.role !== 'admin' && course.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update course
    Object.assign(course, req.body);
    await course.save();

    res.json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course',
      error: error.message
    });
  }
});

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private (Admin)
const deleteCourse = asyncHandler(async (req, res) => {
  try {
    const user = req.user;

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to this course
    if (user.role !== 'admin' && course.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete videos from Cloudinary
    if (course.videos && course.videos.length > 0) {
      for (const video of course.videos) {
        if (video.videoUrl) {
          try {
            // Extract public ID from Cloudinary URL
            const urlParts = video.videoUrl.split('/');
            const publicId = urlParts[urlParts.length - 1].split('.')[0];
            await uploadToCloudinary.deleteResource(publicId, 'video');
          } catch (cloudinaryError) {
            console.error('Cloudinary delete error:', cloudinaryError);
            // Continue even if Cloudinary deletion fails
          }
        }
      }
    }

    await Course.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      error: error.message
    });
  }
});

// @desc    Upload video to course
// @route   POST /api/courses/:id/videos/upload
// @access  Private (Admin)
const uploadVideoToCourse = asyncHandler(async (req, res) => {
  try {
    console.log('🎥 Video upload request received');
    console.log('   File:', req.file);
    console.log('   Body:', req.body);
    console.log('   Headers:', req.headers);
    console.log('   Course ID:', req.params.id);
    
    if (!req.file) {
      console.log('   ❌ No file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No video file uploaded'
      });
    }

    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
    console.log(`   📦 File size: ${fileSizeMB} MB`);

    // Check file size - Cloudinary free tier limit is typically 100MB per file
    // For larger files, you need a paid Cloudinary plan
    if (req.file.size > 100 * 1024 * 1024) { // 100MB - Cloudinary free tier limit
      console.log(`   ⚠️ Warning: File size (${fileSizeMB}MB) exceeds Cloudinary free tier limit (100MB)`);
      console.log('   💡 Consider: 1) Compress the video, 2) Upgrade Cloudinary plan, 3) Use alternative storage');
      return res.status(413).json({
        success: false,
        message: `Video too large (${fileSizeMB}MB). Cloudinary free tier supports up to 100MB per video. Please compress the video or upgrade your Cloudinary plan.`
      });
    }

    const { title, description, order } = req.body;
    const user = req.user;

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to this course
    if (user.role !== 'admin' && course.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get video duration from Cloudinary
    const duration = await uploadToCloudinary.getVideoDuration(req.file.filename);

    // Create video data
    const videoData = {
      title: title || req.file.originalname,
      description: description || '',
      videoUrl: req.file.path,
      thumbnail: req.file.path.replace('/upload/', '/upload/w_300,h_200,c_pad,f_jpg/'),
      duration: duration || 0,
      order: parseInt(order) || course.videos.length + 1,
      isPublished: true,
      uploadedAt: new Date(),
      viewCount: 0
    };

    // Add video to course
    await course.addVideo(videoData);

    // Fetch updated course
    const updatedCourse = await Course.findById(req.params.id);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        video: videoData,
        course: updatedCourse
      }
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Video upload failed',
      error: error.message
    });
  }
});

// @desc    Delete video from course
// @route   DELETE /api/courses/:courseId/videos/:videoId
// @access  Private (Admin)
const deleteVideoFromCourse = asyncHandler(async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const user = req.user;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to this course
    if (user.role !== 'admin' && course.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Find the video to delete
    const video = course.videos.id(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Delete from Cloudinary
    if (video.videoUrl) {
      try {
        const urlParts = video.videoUrl.split('/');
        const publicId = urlParts[urlParts.length - 1].split('.')[0];
        await uploadToCloudinary.deleteResource(publicId, 'video');
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
        // Continue even if Cloudinary deletion fails
      }
    }

    // Remove video from course
    await course.removeVideo(videoId);

    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete video',
      error: error.message
    });
  }
});

// @desc    Update video order
// @route   PUT /api/courses/:courseId/videos/:videoId/order
// @access  Private (Admin)
const updateVideoOrder = asyncHandler(async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { order } = req.body;
    const user = req.user;

    if (!order || order < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid order number is required'
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to this course
    if (user.role !== 'admin' && course.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await course.updateVideoOrder(videoId, order);

    res.json({
      success: true,
      message: 'Video order updated successfully'
    });
  } catch (error) {
    console.error('Update video order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update video order',
      error: error.message
    });
  }
});

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  uploadVideoToCourse,
  deleteVideoFromCourse,
  updateVideoOrder
};
