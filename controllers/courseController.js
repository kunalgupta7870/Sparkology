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

    // Validate preview videos - only one allowed
    if (courseData.videos && Array.isArray(courseData.videos)) {
      const previewVideos = courseData.videos.filter(v => v.isPreview);
      if (previewVideos.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Only one preview video is allowed per course'
        });
      }
    }

    // Set isPaid based on price
    if (courseData.price && courseData.price > 0) {
      courseData.isPaid = true;
      courseData.currency = courseData.currency || 'INR';
    }

    const course = await Course.create(courseData);

    console.log('✅ Course created:', {
      id: course._id,
      name: course.name,
      price: course.price,
      isPaid: course.isPaid,
      videoCount: course.videos?.length || 0,
      hasPreview: course.videos?.some(v => v.isPreview) || false
    });

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

    // Validate preview videos if videos are being updated
    if (req.body.videos && Array.isArray(req.body.videos)) {
      const previewVideos = req.body.videos.filter(v => v.isPreview);
      if (previewVideos.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Only one preview video is allowed per course'
        });
      }
    }

    // Update course
    Object.assign(course, req.body);
    await course.save();

    console.log('✅ Course updated:', {
      id: course._id,
      name: course.name,
      price: course.price,
      isPaid: course.isPaid,
      videoCount: course.videos?.length || 0,
      previewVideos: course.videos?.filter(v => v.isPreview).length || 0
    });

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
    // Admin users can delete any course
    // School admins can only delete courses from their school or courses without schoolId (global courses)
    if (user.role !== 'admin') {
      if (course.schoolId && course.schoolId.toString() !== (user.schoolId || user.school_id)?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
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

    const { title, description, order, isPreview } = req.body;
    const user = req.user;

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has access to this course
    // Admin users can upload to any course
    // School admins can upload to their school's courses or global courses (no schoolId)
    if (user.role !== 'admin') {
      if (course.schoolId && course.schoolId.toString() !== (user.schoolId || user.school_id)?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if trying to add preview when one already exists
    const previewVideoExists = course.videos.find(v => v.isPreview);
    if (isPreview === 'true' && previewVideoExists) {
      return res.status(400).json({
        success: false,
        message: 'Only one preview video is allowed per course. Please remove the existing preview first.'
      });
    }

    // Get video duration from uploaded file
    let duration = 0;
    
    console.log('   🔍 Extracting video duration...');
    console.log('   📋 Available req.file properties:', Object.keys(req.file));
    
    // Extract public_id from filename - multer-storage-cloudinary stores it there
    const publicId = req.file.filename; // e.g., 'master-portal/videos/foixed9o4unbphsxaddd'
    console.log('   🎯 Public ID:', publicId);
    
    // Fetch duration from Cloudinary API
    try {
      console.log('   🔍 Fetching video metadata from Cloudinary API...');
      
      // Add a small delay to allow Cloudinary to process the video metadata
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds
      
      duration = await uploadToCloudinary.getVideoDuration(publicId);
      // Round to whole seconds (no decimals)
      duration = Math.round(duration);
      
      if (duration > 0) {
        console.log('   ✅ Successfully retrieved duration:', duration, 'seconds');
      } else {
        console.log('   ⚠️ Cloudinary returned 0 duration - video may still be processing');
        // Try one more time with longer delay
        console.log('   🔄 Retrying after additional delay...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 more seconds
        duration = await uploadToCloudinary.getVideoDuration(publicId);
        // Round to whole seconds (no decimals)
        duration = Math.round(duration);
        console.log('   🔄 Retry result:', duration, 'seconds');
      }
    } catch (error) {
      console.error('   ❌ Error fetching duration from Cloudinary API:', error.message);
      console.log('   💡 Video uploaded successfully but duration will be 0');
      console.log('   💡 You can manually update the duration later');
    }

    // Create video data
    const videoData = {
      title: title || req.file.originalname,
      description: description || '',
      videoUrl: req.file.path,
      thumbnail: req.file.path.replace('/upload/', '/upload/w_300,h_200,c_pad,f_jpg/'),
      duration: duration || 0,
      order: parseInt(order) || course.videos.length + 1,
      isPublished: true,
      isPreview: isPreview === 'true',
      uploadedAt: new Date(),
      viewCount: 0
    };

    console.log('   📝 Video data:', { ...videoData, videoUrl: 'truncated', duration });
    console.log('   🎬 Is Preview:', videoData.isPreview);

    // Add video to course
    await course.addVideo(videoData);

    // Fetch updated course to get the video with _id
    const updatedCourse = await Course.findById(req.params.id);
    
    // Find the newly added video (should be the last one or match by title/url)
    const addedVideo = updatedCourse.videos[updatedCourse.videos.length - 1];

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        video: addedVideo, // Return the video with _id
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
    // Admin users can delete from any course
    // School admins can delete from their school's courses or global courses (no schoolId)
    if (user.role !== 'admin') {
      if (course.schoolId && course.schoolId.toString() !== (user.schoolId || user.school_id)?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
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
    // Admin users can update any course
    // School admins can update their school's courses or global courses (no schoolId)
    if (user.role !== 'admin') {
      if (course.schoolId && course.schoolId.toString() !== (user.schoolId || user.school_id)?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
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

// @desc    Get preview video for a course (for non-purchasers)
// @route   GET /api/courses/:id/preview
// @access  Public/Private
const getCoursePreview = asyncHandler(async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .select('name description instructor thumbnail price currency isPaid')
      .populate('schoolId', 'name');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get full course with videos to find preview
    const fullCourse = await Course.findById(req.params.id);
    const previewVideo = fullCourse.getPreviewVideo();

    res.json({
      success: true,
      data: {
        course: {
          id: course._id,
          name: course.name,
          description: course.description,
          instructor: course.instructor,
          thumbnail: course.thumbnail,
          price: course.price,
          currency: course.currency,
          isPaid: course.isPaid,
          videoCount: fullCourse.videos.length
        },
        previewVideo: previewVideo || null,
        message: previewVideo 
          ? 'Preview video available' 
          : 'No preview video available for this course'
      }
    });
  } catch (error) {
    console.error('Get course preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course preview',
      error: error.message
    });
  }
});

// @desc    Get course videos (for purchasers only)
// @route   GET /api/courses/:id/videos
// @access  Private (requires purchase or admin)
const getCourseVideos = asyncHandler(async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // For now, return all videos. 
    // TODO: Add purchase verification logic
    const user = req.user;
    const hasAccess = user.role === 'admin' || 
                     !course.schoolId || 
                     course.schoolId.toString() === (user.schoolId || user.school_id)?.toString();

    if (!hasAccess) {
      // Return only preview video for non-purchasers
      const previewVideo = course.getPreviewVideo();
      return res.json({
        success: true,
        data: {
          videos: previewVideo ? [previewVideo] : [],
          message: 'Purchase course to access all videos',
          isPurchased: false
        }
      });
    }

    // Return all videos for users with access
    const sortedVideos = course.getVideosSorted();
    res.json({
      success: true,
      data: {
        videos: sortedVideos,
        isPurchased: true,
        previewVideo: course.getPreviewVideo()
      }
    });
  } catch (error) {
    console.error('Get course videos error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course videos',
      error: error.message
    });
  }
});

// @desc    Upload note (PDF) to course
// @route   POST /api/courses/:id/notes/upload
// @access  Private (Admin)
const uploadNoteToCourse = asyncHandler(async (req, res) => {
  try {
    console.log('📄 Note upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    const { title, description, order } = req.body;
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const noteData = {
      title: title || req.file.originalname,
      description: description || '',
      fileUrl: req.file.path,
      fileSize: req.file.size,
      order: parseInt(order) || course.notes.length + 1,
      uploadedAt: new Date()
    };

    await course.addNote(noteData);

    res.status(201).json({
      success: true,
      message: 'Note uploaded successfully',
      data: noteData
    });
  } catch (error) {
    console.error('Note upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Note upload failed',
      error: error.message
    });
  }
});

// @desc    Delete note from course
// @route   DELETE /api/courses/:courseId/notes/:noteId
// @access  Private (Admin)
const deleteNoteFromCourse = asyncHandler(async (req, res) => {
  try {
    const { courseId, noteId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await course.removeNote(noteId);

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete note',
      error: error.message
    });
  }
});

// @desc    Add quiz question to course
// @route   POST /api/courses/:id/quiz
// @access  Private (Admin)
const addQuizQuestion = asyncHandler(async (req, res) => {
  try {
    const { question, options, correctAnswer, explanation, difficulty, order } = req.body;
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Validate options - must be exactly 4
    if (!options || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'Exactly 4 options are required'
      });
    }

    // Validate correct answer
    if (correctAnswer < 0 || correctAnswer >= 4) {
      return res.status(400).json({
        success: false,
        message: 'Correct answer must be between 0 and 3'
      });
    }

    const questionData = {
      question,
      options,
      correctAnswer,
      explanation: explanation || '',
      difficulty: difficulty || 'medium',
      order: parseInt(order) || course.quizQuestions.length + 1
    };

    await course.addQuizQuestion(questionData);

    res.status(201).json({
      success: true,
      message: 'Quiz question added successfully',
      data: questionData
    });
  } catch (error) {
    console.error('Add quiz question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add quiz question',
      error: error.message
    });
  }
});

// @desc    Update quiz question
// @route   PUT /api/courses/:courseId/quiz/:questionId
// @access  Private (Admin)
const updateQuizQuestion = asyncHandler(async (req, res) => {
  try {
    const { courseId, questionId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await course.updateQuizQuestion(questionId, req.body);

    res.json({
      success: true,
      message: 'Quiz question updated successfully'
    });
  } catch (error) {
    console.error('Update quiz question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz question',
      error: error.message
    });
  }
});

// @desc    Delete quiz question
// @route   DELETE /api/courses/:courseId/quiz/:questionId
// @access  Private (Admin)
const deleteQuizQuestion = asyncHandler(async (req, res) => {
  try {
    const { courseId, questionId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await course.removeQuizQuestion(questionId);

    res.json({
      success: true,
      message: 'Quiz question deleted successfully'
    });
  } catch (error) {
    console.error('Delete quiz question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz question',
      error: error.message
    });
  }
});

// ============================================
// NAMED QUIZZES MANAGEMENT (NEW STRUCTURE)
// ============================================

// @desc    Add a complete quiz with multiple questions
// @route   POST /api/courses/:id/quizzes
// @access  Private (Admin)
const addQuizToCourse = asyncHandler(async (req, res) => {
  try {
    const { title, description, timeLimit, passingScore, questions } = req.body;
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Validate
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quiz title and at least one question are required'
      });
    }

    const quizData = {
      title,
      description: description || '',
      timeLimit: timeLimit || 30,
      passingScore: passingScore || 60,
      questions: questions.map((q, index) => ({
        ...q,
        order: q.order || index + 1
      })),
      createdAt: new Date()
    };

    await course.addQuiz(quizData);

    const updatedCourse = await Course.findById(req.params.id);

    res.status(201).json({
      success: true,
      message: 'Quiz added successfully',
      data: {
        quizzes: updatedCourse.quizzes,
        quizzesCount: updatedCourse.quizzesCount
      }
    });
  } catch (error) {
    console.error('Add quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add quiz',
      error: error.message
    });
  }
});

// @desc    Get all quizzes for a course
// @route   GET /api/courses/:id/quizzes
// @access  Private
const getCourseQuizzes = asyncHandler(async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const quizzes = (course.quizzes || []).map(quiz => ({
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit,
      passingScore: quiz.passingScore,
      questionCount: quiz.questions?.length || 0,
      createdAt: quiz.createdAt
    }));

    res.json({
      success: true,
      data: quizzes
    });
  } catch (error) {
    console.error('Get course quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quizzes',
      error: error.message
    });
  }
});

// @desc    Get specific quiz details
// @route   GET /api/courses/:courseId/quizzes/:quizId
// @access  Private
const getCourseQuizDetails = asyncHandler(async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const quiz = course.getQuizById(quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    res.json({
      success: true,
      data: { quiz }
    });
  } catch (error) {
    console.error('Get quiz details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz details',
      error: error.message
    });
  }
});

// @desc    Update a quiz
// @route   PUT /api/courses/:courseId/quizzes/:quizId
// @access  Private (Admin)
const updateCourseQuiz = asyncHandler(async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await course.updateQuiz(quizId, req.body);

    res.json({
      success: true,
      message: 'Quiz updated successfully'
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz',
      error: error.message
    });
  }
});

// @desc    Delete a quiz
// @route   DELETE /api/courses/:courseId/quizzes/:quizId
// @access  Private (Admin)
const deleteCourseQuiz = asyncHandler(async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await course.removeQuiz(quizId);

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz',
      error: error.message
    });
  }
});

// @desc    Upload thumbnail to course
// @route   POST /api/courses/:id/thumbnail
// @access  Private (Admin)
const uploadCourseThumbnail = asyncHandler(async (req, res) => {
  try {
    console.log('🖼️ Thumbnail upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Update course thumbnail with Cloudinary URL
    course.thumbnail = req.file.path;
    await course.save();

    res.status(200).json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      data: {
        thumbnail: req.file.path
      }
    });
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Thumbnail upload failed',
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
  updateVideoOrder,
  getCoursePreview,
  getCourseVideos,
  uploadNoteToCourse,
  deleteNoteFromCourse,
  addQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  uploadCourseThumbnail,
  addQuizToCourse,
  getCourseQuizzes,
  getCourseQuizDetails,
  updateCourseQuiz,
  deleteCourseQuiz
};
