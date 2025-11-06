const asyncHandler = require('../middleware/asyncHandler');
const CoCurricularPost = require('../models/CoCurricularPost');
const Student = require('../models/Student');
const { uploadToCloudinary } = require('../utils/cloudinary');

// @desc    Get all co-curricular posts (only classmates can see)
// @route   GET /api/co-curricular
// @access  Private (Student only)
const getPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  // Get student to access their classId
  const student = await Student.findById(req.user._id);
  if (!student || !student.classId) {
    return res.status(404).json({
      success: false,
      error: 'Student profile or class not found'
    });
  }

  // Only show posts from students in the same class
  const posts = await CoCurricularPost.find({
    classId: student.classId,
    schoolId: student.schoolId
  })
    .populate('student', 'name email avatar rollNumber')
    .populate('classId', 'name section')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await CoCurricularPost.countDocuments({
    classId: student.classId,
    schoolId: student.schoolId
  });

  res.json({
    success: true,
    count: posts.length,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    data: posts
  });
});

// @desc    Get single post
// @route   GET /api/co-curricular/:id
// @access  Private (Student only)
const getPost = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);
  if (!student || !student.classId) {
    return res.status(404).json({
      success: false,
      error: 'Student profile or class not found'
    });
  }

  const post = await CoCurricularPost.findById(req.params.id)
    .populate('student', 'name email avatar rollNumber')
    .populate('classId', 'name section');

  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    });
  }

  // Verify that the post is from the same class
  if (post.classId._id.toString() !== student.classId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'You can only view posts from your classmates'
    });
  }

  res.json({
    success: true,
    data: post
  });
});

// @desc    Create new post (only students can post)
// @route   POST /api/co-curricular
// @access  Private (Student only)
const createPost = asyncHandler(async (req, res) => {
  const { title, description, category } = req.body;
  const studentId = req.user._id;

  console.log('📸 Co-curricular Post: Received request');
  console.log('📸 Co-curricular Post: Body:', { title, description, category });
  console.log('📸 Co-curricular Post: Files:', req.files ? `${req.files.length} files` : 'no files');
  console.log('📸 Co-curricular Post: req.files:', req.files);
  console.log('📸 Co-curricular Post: req.file:', req.file);
  console.log('📸 Co-curricular Post: Headers:', req.headers['content-type']);

  // Get student to access their classId and schoolId
  const student = await Student.findById(studentId);
  if (!student || !student.classId) {
    return res.status(404).json({
      success: false,
      error: 'Student profile or class not found'
    });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Title is required'
    });
  }

  if (!description || !description.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Description is required'
    });
  }

  if (!category || !category.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Category is required'
    });
  }

  // Handle image uploads if provided - files are already uploaded to Cloudinary
  // Students can only upload 1 photo per CCA post
  if (req.files && req.files.length > 1) {
    return res.status(400).json({
      success: false,
      error: 'Only 1 photo is allowed per post'
    });
  }

  const images = [];
  if (req.files && req.files.length > 0) {
    console.log('📸 Co-curricular Post: Processing', req.files.length, 'files from Cloudinary');
    for (const file of req.files) {
      try {
        // When using CloudinaryStorage, file.path is the Cloudinary URL
        // and file.filename is the public_id
        const imageUrl = file.path || file.secure_url;
        const publicId = file.filename || file.public_id;
        
        console.log('📸 Co-curricular Post: Cloudinary file:', {
          url: imageUrl,
          publicId: publicId,
          originalname: file.originalname
        });
        
        if (imageUrl) {
          images.push({
            url: imageUrl,
            publicId: publicId
          });
          console.log('📸 Co-curricular Post: Image added successfully:', imageUrl);
        }
      } catch (error) {
        console.error('📸 Co-curricular Post: Error processing image:', error);
        // Continue even if one image fails
      }
    }
  } else {
    console.log('📸 Co-curricular Post: No files received');
  }
  
  console.log('📸 Co-curricular Post: Final images array:', images);

  const post = await CoCurricularPost.create({
    student: studentId,
    classId: student.classId,
    schoolId: student.schoolId,
    title: title.trim(),
    description: description.trim(),
    category: category.trim(),
    images: images
  });

  const populatedPost = await CoCurricularPost.findById(post._id)
    .populate('student', 'name email avatar rollNumber')
    .populate('classId', 'name section');

  // Emit socket event to classmates
  if (global.io) {
    const classRoom = `class_${student.classId}`;
    global.io.to(classRoom).emit('new_co_curricular_post', {
      success: true,
      data: populatedPost
    });
  }

  res.status(201).json({
    success: true,
    data: populatedPost
  });
});

// @desc    Update post (only the creator can update)
// @route   PUT /api/co-curricular/:id
// @access  Private (Student only)
const updatePost = asyncHandler(async (req, res) => {
  const { title, description, category } = req.body;
  const studentId = req.user._id;

  const post = await CoCurricularPost.findById(req.params.id);
  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    });
  }

  // Verify that the student is the creator
  if (post.student.toString() !== studentId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'You can only update your own posts'
    });
  }

  if (title) {
    post.title = title.trim();
  }
  if (description) {
    post.description = description.trim();
  }
  if (category) {
    post.category = category.trim();
  }

  // Handle image uploads if provided - files are already uploaded to Cloudinary
  // Students can only upload 1 photo per CCA post
  if (req.files && req.files.length > 1) {
    return res.status(400).json({
      success: false,
      error: 'Only 1 photo is allowed per post'
    });
  }

  if (req.files && req.files.length > 0) {
    // Delete old images from Cloudinary
    if (post.images && post.images.length > 0) {
      for (const image of post.images) {
        if (image.publicId) {
          try {
            await uploadToCloudinary.deleteResource(image.publicId, 'image');
          } catch (error) {
            console.error('Error deleting old image:', error);
          }
        }
      }
    }

    // Process new images from Cloudinary
    const images = [];
    for (const file of req.files) {
      try {
        // When using CloudinaryStorage, file.path is the Cloudinary URL
        // and file.filename is the public_id
        const imageUrl = file.path || file.secure_url;
        const publicId = file.filename || file.public_id;
        
        console.log('📸 Co-curricular Post: New Cloudinary file:', {
          url: imageUrl,
          publicId: publicId
        });
        
        if (imageUrl) {
          images.push({
            url: imageUrl,
            publicId: publicId
          });
        }
      } catch (error) {
        console.error('📸 Co-curricular Post: Error processing new image:', error);
      }
    }
    post.images = images;
  }

  await post.save();

  const updatedPost = await CoCurricularPost.findById(post._id)
    .populate('student', 'name email avatar rollNumber')
    .populate('classId', 'name section');

  res.json({
    success: true,
    data: updatedPost
  });
});

// @desc    Delete post (only the creator can delete)
// @route   DELETE /api/co-curricular/:id
// @access  Private (Student only)
const deletePost = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const post = await CoCurricularPost.findById(req.params.id);
  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    });
  }

  // Verify that the student is the creator
  if (post.student.toString() !== studentId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'You can only delete your own posts'
    });
  }

  // Delete images from Cloudinary
  if (post.images && post.images.length > 0) {
    for (const image of post.images) {
      if (image.publicId) {
        try {
          await uploadToCloudinary.deleteResource(image.publicId, 'image');
        } catch (error) {
          console.error('Error deleting image:', error);
        }
      }
    }
  }

  await post.deleteOne();

  res.json({
    success: true,
    message: 'Post deleted successfully'
  });
});

// @desc    Like/Unlike post
// @route   PUT /api/co-curricular/:id/like
// @access  Private (Student only)
const toggleLike = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const student = await Student.findById(studentId);
  if (!student || !student.classId) {
    return res.status(404).json({
      success: false,
      error: 'Student profile or class not found'
    });
  }

  const post = await CoCurricularPost.findById(req.params.id);
  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    });
  }

  // Verify that the post is from the same class
  if (post.classId.toString() !== student.classId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'You can only like posts from your classmates'
    });
  }

  await post.toggleLike(studentId);

  const updatedPost = await CoCurricularPost.findById(post._id)
    .populate('student', 'name email avatar rollNumber')
    .populate('classId', 'name section');

  res.json({
    success: true,
    data: updatedPost
  });
});

module.exports = {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  toggleLike
};

