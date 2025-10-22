const SubjectCourse = require('../models/SubjectCourse');
const SubjectCourseQuizAttempt = require('../models/SubjectCourseQuizAttempt');
const Student = require('../models/Student');
const Class = require('../models/Class');
const { uploadToCloudinary } = require('../utils/cloudinary');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all subject courses
// @route   GET /api/subject-courses
// @access  Private (Admin)
const getSubjectCourses = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, subjectName, className } = req.query;

    let query = {};

    // Add filters
    if (subjectName) query.subjectName = { $regex: subjectName, $options: 'i' };
    if (className) query.className = { $regex: className, $options: 'i' };

    const courses = await SubjectCourse.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SubjectCourse.countDocuments(query);

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
    console.error('Get subject courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subject courses',
      error: error.message
    });
  }
});

// @desc    Get subject courses for student (filtered by their class)
// @route   GET /api/subject-courses/student/my-courses
// @access  Private (Student)
const getStudentSubjectCourses = asyncHandler(async (req, res) => {
  try {
    console.log('🎓 Student requesting subject courses');
    console.log('   Student ID:', req.user._id);
    
    // Get the student with their class populated
    const student = await Student.findById(req.user._id)
      .populate('classId', 'name section');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('   Student:', student.name);
    console.log('   Student classId:', student.classId);

    // Check if student has a class assigned
    if (!student.classId) {
      console.log('   ⚠️ Student has no class assigned');
      return res.json({
        success: true,
        data: [],
        message: 'No class assigned to student'
      });
    }

    const className = student.classId.name;
    console.log('   Student class name:', className);

    // Find all subject courses that match the student's class name
    // Match by exact class name OR by class number (e.g., "5" matches "Class 5" or "5")
    const courses = await SubjectCourse.find({
      $or: [
        { className: className }, // Exact match
        { className: new RegExp(`^${className}$`, 'i') }, // Case-insensitive exact match
        { className: new RegExp(`class\\s*${className}`, 'i') }, // Match "Class 5" when student has "5"
        { className: new RegExp(`^${className.replace(/class\s*/i, '')}$`, 'i') } // Match "5" when student has "Class 5"
      ]
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    console.log(`   ✅ Found ${courses.length} courses for class ${className}`);

    res.json({
      success: true,
      data: courses,
      studentClass: {
        name: className,
        section: student.classId.section
      }
    });
  } catch (error) {
    console.error('Get student subject courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subject courses',
      error: error.message
    });
  }
});

// @desc    Get subject course by ID
// @route   GET /api/subject-courses/:id
// @access  Private (Admin)
const getSubjectCourse = asyncHandler(async (req, res) => {
  try {
    const course = await SubjectCourse.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    res.json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Get subject course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subject course',
      error: error.message
    });
  }
});

// @desc    Create subject course
// @route   POST /api/subject-courses
// @access  Private (Admin)
const createSubjectCourse = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    const courseData = {
      ...req.body,
      createdBy: user._id
    };

    const course = await SubjectCourse.create(courseData);

    // Populate the course before sending response
    const populatedCourse = await SubjectCourse.findById(course._id)
      .populate('createdBy', 'name email');

    console.log('✅ Subject course created:', {
      id: course._id,
      title: course.title,
      subject: courseData.subjectName,
      class: courseData.className
    });

    res.status(201).json({
      success: true,
      message: 'Subject course created successfully',
      data: populatedCourse
    });
  } catch (error) {
    console.error('Create subject course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subject course',
      error: error.message
    });
  }
});

// @desc    Update subject course
// @route   PUT /api/subject-courses/:id
// @access  Private (Admin)
const updateSubjectCourse = asyncHandler(async (req, res) => {
  try {
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    // Update course
    Object.assign(course, req.body);
    await course.save();

    // Populate the course before sending response
    const populatedCourse = await SubjectCourse.findById(course._id)
      .populate('createdBy', 'name email');

    console.log('✅ Subject course updated:', {
      id: course._id,
      title: course.title,
      videoCount: course.videos?.length || 0
    });

    res.json({
      success: true,
      message: 'Subject course updated successfully',
      data: populatedCourse
    });
  } catch (error) {
    console.error('Update subject course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subject course',
      error: error.message
    });
  }
});

// @desc    Delete subject course
// @route   DELETE /api/subject-courses/:id
// @access  Private (Admin)
const deleteSubjectCourse = asyncHandler(async (req, res) => {
  try {
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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

    await SubjectCourse.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Subject course deleted successfully'
    });
  } catch (error) {
    console.error('Delete subject course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subject course',
      error: error.message
    });
  }
});

// @desc    Upload video to subject course
// @route   POST /api/subject-courses/:id/videos/upload
// @access  Private (Admin)
const uploadVideoToSubjectCourse = asyncHandler(async (req, res) => {
  try {
    console.log('🎥 Video upload request received');
    console.log('   File:', req.file);
    console.log('   Body:', req.body);
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
    if (req.file.size > 100 * 1024 * 1024) { // 100MB - Cloudinary free tier limit
      console.log(`   ⚠️ Warning: File size (${fileSizeMB}MB) exceeds Cloudinary free tier limit (100MB)`);
      return res.status(413).json({
        success: false,
        message: `Video too large (${fileSizeMB}MB). Cloudinary free tier supports up to 100MB per video. Please compress the video or upgrade your Cloudinary plan.`
      });
    }

    const { title, description, order } = req.body;

    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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
      uploadedAt: new Date(),
      viewCount: 0
    };

    console.log('   📝 Video data:', { ...videoData, videoUrl: 'truncated', duration });

    // Add video to course
    await course.addVideo(videoData);

    // Fetch updated course
    const updatedCourse = await SubjectCourse.findById(req.params.id)
      .populate('createdBy', 'name email');

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

// @desc    Delete video from subject course
// @route   DELETE /api/subject-courses/:courseId/videos/:videoId
// @access  Private (Admin)
const deleteVideoFromSubjectCourse = asyncHandler(async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await SubjectCourse.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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
// @route   PUT /api/subject-courses/:courseId/videos/:videoId/order
// @access  Private (Admin)
const updateVideoOrder = asyncHandler(async (req, res) => {
  try {
    const { courseId, videoId } = req.params;
    const { order } = req.body;

    if (!order || order < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid order number is required'
      });
    }

    const course = await SubjectCourse.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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

// @desc    Get subject course videos
// @route   GET /api/subject-courses/:id/videos
// @access  Private
const getSubjectCourseVideos = asyncHandler(async (req, res) => {
  try {
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    // Return all videos
    const sortedVideos = course.getVideosSorted();
    res.json({
      success: true,
      data: {
        videos: sortedVideos
      }
    });
  } catch (error) {
    console.error('Get subject course videos error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subject course videos',
      error: error.message
    });
  }
});

// @desc    Upload note (PDF) to subject course
// @route   POST /api/subject-courses/:id/notes/upload
// @access  Private (Admin)
const uploadNoteToSubjectCourse = asyncHandler(async (req, res) => {
  try {
    console.log('📄 Note upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    const { title, description, order } = req.body;
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    // Use local file path (same as assignments and notes)
    const fileUrl = `/uploads/documents/${req.file.filename}`;

    const noteData = {
      title: title || req.file.originalname,
      description: description || '',
      fileUrl: fileUrl,
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

// @desc    Delete note from subject course
// @route   DELETE /api/subject-courses/:courseId/notes/:noteId
// @access  Private (Admin)
const deleteNoteFromSubjectCourse = asyncHandler(async (req, res) => {
  try {
    const { courseId, noteId } = req.params;
    const course = await SubjectCourse.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    // Find the note to delete
    const note = course.notes.id(noteId);
    if (note) {
      // Delete the file from local storage
      try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', note.fileUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error('File deletion error:', fileError);
        // Continue even if file deletion fails
      }
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

// @desc    Add quiz question to subject course
// @route   POST /api/subject-courses/:id/quiz
// @access  Private (Admin)
const addQuizQuestion = asyncHandler(async (req, res) => {
  try {
    const { question, options, correctAnswer, explanation, difficulty, order } = req.body;
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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
// @route   PUT /api/subject-courses/:courseId/quiz/:questionId
// @access  Private (Admin)
const updateQuizQuestion = asyncHandler(async (req, res) => {
  try {
    const { courseId, questionId } = req.params;
    const course = await SubjectCourse.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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
// @route   DELETE /api/subject-courses/:courseId/quiz/:questionId
// @access  Private (Admin)
const deleteQuizQuestion = asyncHandler(async (req, res) => {
  try {
    const { courseId, questionId } = req.params;
    const course = await SubjectCourse.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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

// @desc    Upload thumbnail to subject course
// @route   POST /api/subject-courses/:id/thumbnail
// @access  Private (Admin)
const uploadSubjectCourseThumbnail = asyncHandler(async (req, res) => {
  try {
    console.log('🖼️ Thumbnail upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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

// @desc    Update quiz metadata (title, time limit, etc.)
// @route   PUT /api/subject-courses/:id/quiz/metadata
// @access  Private (Admin)
const updateQuizMetadata = asyncHandler(async (req, res) => {
  try {
    const { title, timeLimit, passingScore, description } = req.body;
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    const metadata = {};
    if (title !== undefined) metadata.title = title;
    if (timeLimit !== undefined) metadata.timeLimit = timeLimit;
    if (passingScore !== undefined) metadata.passingScore = passingScore;
    if (description !== undefined) metadata.description = description;

    await course.updateQuizMetadata(metadata);

    res.json({
      success: true,
      message: 'Quiz metadata updated successfully',
      data: course.quizMetadata
    });
  } catch (error) {
    console.error('Update quiz metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz metadata',
      error: error.message
    });
  }
});

// @desc    Add multiple quiz questions at once
// @route   POST /api/subject-courses/:id/quiz/bulk
// @access  Private (Admin)
const addBulkQuizQuestions = asyncHandler(async (req, res) => {
  try {
    const { questions, quizMetadata } = req.body;
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    // Validate questions array
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Questions array is required and must not be empty'
      });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.question || !q.options || !Array.isArray(q.options) || q.options.length !== 4) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1}: Must have a question text and exactly 4 options`
        });
      }

      if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer > 3) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1}: Correct answer must be between 0 and 3`
        });
      }
    }

    // Update quiz metadata if provided
    if (quizMetadata) {
      await course.updateQuizMetadata(quizMetadata);
    }

    // Add all questions
    await course.addMultipleQuizQuestions(questions);

    // Fetch updated course
    const updatedCourse = await SubjectCourse.findById(req.params.id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: `Successfully added ${questions.length} quiz questions`,
      data: {
        quizMetadata: updatedCourse.quizMetadata,
        quizQuestions: updatedCourse.quizQuestions,
        quizCount: updatedCourse.quizCount
      }
    });
  } catch (error) {
    console.error('Add bulk quiz questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add quiz questions',
      error: error.message
    });
  }
});

// @desc    Get quiz metadata
// @route   GET /api/subject-courses/:id/quiz/metadata
// @access  Private
const getQuizMetadata = asyncHandler(async (req, res) => {
  try {
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    // Check if student has already completed this quiz (only for students)
    let hasCompleted = false;
    if (req.user.role === 'student') {
      hasCompleted = await SubjectCourseQuizAttempt.hasStudentCompleted(req.user._id, req.params.id);
    }

    res.json({
      success: true,
      data: {
        quizMetadata: course.quizMetadata,
        questionCount: course.quizQuestions.length,
        hasCompleted
      }
    });
  } catch (error) {
    console.error('Get quiz metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz metadata',
      error: error.message
    });
  }
});

// @desc    Add a complete quiz to subject course
// @route   POST /api/subject-courses/:id/quizzes
// @access  Private (Admin)
const addQuizToCourse = asyncHandler(async (req, res) => {
  try {
    const { title, description, timeLimit, passingScore, questions } = req.body;
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
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

    const updatedCourse = await SubjectCourse.findById(req.params.id);

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
// @route   GET /api/subject-courses/:id/quizzes
// @access  Private
const getCourseQuizzes = asyncHandler(async (req, res) => {
  try {
    const course = await SubjectCourse.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    // Get student's completed quizzes if student
    let completedQuizIds = [];
    if (req.user.role === 'student') {
      const attempts = await SubjectCourseQuizAttempt.getStudentCourseAttempts(
        req.user._id,
        req.params.id
      );
      completedQuizIds = attempts
        .filter(a => a.quizId) // Filter out attempts with undefined quizId
        .map(a => a.quizId.toString());
    }

    // Ensure quizzes array exists
    const quizzes = course.quizzes || [];
    
    const quizzesWithCompletion = quizzes.map(quiz => ({
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit,
      passingScore: quiz.passingScore,
      questionCount: quiz.questions?.length || 0,
      createdAt: quiz.createdAt,
      isCompleted: completedQuizIds.includes(quiz._id.toString())
    }));

    res.json({
      success: true,
      data: quizzesWithCompletion
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
// @route   GET /api/subject-courses/:courseId/quizzes/:quizId
// @access  Private
const getQuizDetails = asyncHandler(async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const course = await SubjectCourse.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    const quiz = course.getQuizById(quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check completion status if student
    let hasCompleted = false;
    let previousAttempt = null;
    if (req.user.role === 'student') {
      hasCompleted = await SubjectCourseQuizAttempt.hasStudentCompleted(
        req.user._id,
        courseId,
        quizId
      );
      if (hasCompleted) {
        previousAttempt = await SubjectCourseQuizAttempt.getStudentAttempt(
          req.user._id,
          courseId,
          quizId
        );
      }
    }

    res.json({
      success: true,
      data: {
        quiz,
        hasCompleted,
        previousAttempt: previousAttempt ? {
          score: previousAttempt.score,
          passed: previousAttempt.passed,
          completedAt: previousAttempt.completedAt
        } : null
      }
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

// @desc    Submit quiz attempt
// @route   POST /api/subject-courses/:courseId/quizzes/:quizId/submit
// @access  Private (Student)
const submitQuizAttempt = asyncHandler(async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const { answers, timeSpent } = req.body;
    const course = await SubjectCourse.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Subject course not found'
      });
    }

    const quiz = course.getQuizById(quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Check if student has already completed this specific quiz
    const existingAttempt = await SubjectCourseQuizAttempt.findOne({
      studentId: req.user._id,
      subjectCourseId: courseId,
      quizId: quizId
    });

    if (existingAttempt) {
      return res.status(400).json({
        success: false,
        message: 'You have already completed this quiz'
      });
    }

    // Calculate score
    let correctCount = 0;
    const processedAnswers = [];

    quiz.questions.forEach((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer !== undefined && userAnswer === question.correctAnswer;
      
      if (isCorrect) correctCount++;

      processedAnswers.push({
        questionId: question._id,
        selectedAnswer: userAnswer !== undefined ? userAnswer : -1,
        isCorrect
      });
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passingScore = quiz.passingScore || 60;
    const passed = score >= passingScore;

    // Save attempt
    const attempt = await SubjectCourseQuizAttempt.create({
      studentId: req.user._id,
      subjectCourseId: courseId,
      quizId: quizId,
      answers: processedAnswers,
      score,
      totalQuestions: quiz.questions.length,
      correctAnswers: correctCount,
      timeSpent,
      passed
    });

    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      data: {
        score,
        correctAnswers: correctCount,
        totalQuestions: quiz.questions.length,
        passed,
        passingScore
      }
    });
  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quiz',
      error: error.message
    });
  }
});

// @desc    Check if student has completed quiz
// @route   GET /api/subject-courses/:id/quiz/check-completion
// @access  Private (Student)
const checkQuizCompletion = asyncHandler(async (req, res) => {
  try {
    const hasCompleted = await SubjectCourseQuizAttempt.hasStudentCompleted(
      req.user._id, 
      req.params.id
    );

    const attempt = await SubjectCourseQuizAttempt.getStudentAttempt(
      req.user._id,
      req.params.id
    );

    res.json({
      success: true,
      data: {
        hasCompleted,
        attempt: attempt ? {
          score: attempt.score,
          passed: attempt.passed,
          completedAt: attempt.completedAt
        } : null
      }
    });
  } catch (error) {
    console.error('Check quiz completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check quiz completion',
      error: error.message
    });
  }
});

module.exports = {
  getSubjectCourses,
  getStudentSubjectCourses,
  getSubjectCourse,
  createSubjectCourse,
  updateSubjectCourse,
  deleteSubjectCourse,
  uploadVideoToSubjectCourse,
  deleteVideoFromSubjectCourse,
  updateVideoOrder,
  getSubjectCourseVideos,
  uploadNoteToSubjectCourse,
  deleteNoteFromSubjectCourse,
  addQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  uploadSubjectCourseThumbnail,
  updateQuizMetadata,
  addBulkQuizQuestions,
  getQuizMetadata,
  submitQuizAttempt,
  checkQuizCompletion,
  addQuizToCourse,
  getCourseQuizzes,
  getQuizDetails
};

