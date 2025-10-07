const Photo = require('../models/Photo');
const { uploadToCloudinary } = require('../utils/cloudinary');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Upload a photo
// @route   POST /api/photos/upload
// @access  Private (Admin)
const uploadPhoto = asyncHandler(async (req, res) => {
  try {
    console.log('📸 Photo upload request received');
    console.log('   File:', req.file);
    console.log('   Body:', req.body);
    console.log('   User:', req.user?.email);
    
    if (!req.file) {
      console.log('   ❌ No file uploaded');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    console.log('   ✅ File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      cloudinaryPath: req.file.path,
      cloudinaryId: req.file.filename
    });

    // Check file size
    if (req.file.size > 25 * 1024 * 1024) { // 25MB
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 25MB for photos.'
      });
    }

    const { title, description, category, tags } = req.body;
    const user = req.user;

    // Create photo document
    const photoData = {
      title: title || req.file.originalname,
      description: description || '',
      imageUrl: req.file.path,
      thumbnailUrl: req.file.path.replace('/upload/', '/upload/w_300,h_200,c_fill/'),
      cloudinaryId: req.file.filename,
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: user._id,
      category: category || 'general',
      tags: tags ? JSON.parse(tags) : [],
      width: req.file.width || 0,
      height: req.file.height || 0
    };
    
    // Only add schoolId if user has one (admin users don't have schoolId)
    if (user.schoolId || user.school_id) {
      photoData.schoolId = user.schoolId || user.school_id;
    }

    console.log('   💾 Saving to database...');
    const photo = await Photo.create(photoData);
    console.log('   ✅ Photo saved to database:', photo._id);

    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: photo
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Photo upload failed',
      error: error.message
    });
  }
});

// @desc    Get all photos
// @route   GET /api/photos
// @access  Private (Admin)
const getPhotos = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, tags } = req.query;
    const user = req.user;

    let query = { isActive: true };

    // If user is not admin, show photos from their school OR photos without schoolId (admin-created global photos)
    if (user.role !== 'admin') {
      query.$or = [
        { schoolId: user.schoolId || user.school_id },
        { schoolId: { $exists: false } }, // Admin-created global photos
        { schoolId: null } // Admin-created global photos
      ];
    }

    // Add filters
    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$and = [
        ...(query.$or ? [{ $or: query.$or }] : []),
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } }
          ]
        }
      ];
      delete query.$or; // Remove the original $or since we moved it to $and
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }

    const photos = await Photo.find(query)
      .populate('uploadedBy', 'name email')
      .populate('schoolId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Photo.countDocuments(query);

    res.json({
      success: true,
      data: photos,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photos',
      error: error.message
    });
  }
});

// @desc    Get photo by ID
// @route   GET /api/photos/:id
// @access  Private (Admin)
const getPhoto = asyncHandler(async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('schoolId', 'name');

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check if user has access to this photo
    const user = req.user;
    if (user.role !== 'admin' && photo.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment view count
    await photo.incrementViewCount();

    res.json({
      success: true,
      data: photo
    });
  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photo',
      error: error.message
    });
  }
});

// @desc    Update photo
// @route   PUT /api/photos/:id
// @access  Private (Admin)
const updatePhoto = asyncHandler(async (req, res) => {
  try {
    const { title, description, category, tags, isPublic } = req.body;
    const user = req.user;

    const photo = await Photo.findById(req.params.id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check if user has access to this photo
    if (user.role !== 'admin' && photo.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update fields
    if (title) photo.title = title;
    if (description !== undefined) photo.description = description;
    if (category) photo.category = category;
    if (tags) photo.tags = Array.isArray(tags) ? tags : tags.split(',');
    if (isPublic !== undefined) photo.isPublic = isPublic;

    await photo.save();

    res.json({
      success: true,
      message: 'Photo updated successfully',
      data: photo
    });
  } catch (error) {
    console.error('Update photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update photo',
      error: error.message
    });
  }
});

// @desc    Delete photo
// @route   DELETE /api/photos/:id
// @access  Private (Admin)
const deletePhoto = asyncHandler(async (req, res) => {
  try {
    const user = req.user;

    const photo = await Photo.findById(req.params.id);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check if user has access to this photo
    if (user.role !== 'admin' && photo.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete from Cloudinary
    if (photo.cloudinaryId) {
      try {
        await uploadToCloudinary.deleteResource(photo.cloudinaryId);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Delete from database
    await Photo.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete photo',
      error: error.message
    });
  }
});

// @desc    Get photo categories
// @route   GET /api/photos/categories
// @access  Private (Admin)
const getPhotoCategories = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    let query = { isActive: true };

    // If user is not admin, filter by school
    if (user.role !== 'admin') {
      query.schoolId = user.schoolId || user.school_id;
    }

    const categories = await Photo.distinct('category', query);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get photo categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photo categories',
      error: error.message
    });
  }
});

// @desc    Get photo tags
// @route   GET /api/photos/tags
// @access  Private (Admin)
const getPhotoTags = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    let query = { isActive: true };

    // If user is not admin, filter by school
    if (user.role !== 'admin') {
      query.schoolId = user.schoolId || user.school_id;
    }

    const tags = await Photo.distinct('tags', query);

    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    console.error('Get photo tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photo tags',
      error: error.message
    });
  }
});

module.exports = {
  uploadPhoto,
  getPhotos,
  getPhoto,
  updatePhoto,
  deletePhoto,
  getPhotoCategories,
  getPhotoTags
};
