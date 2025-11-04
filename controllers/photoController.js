const FactOfTheDay = require('../models/Photo');
const { uploadToCloudinary } = require('../utils/cloudinary');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Upload a fact
// @route   POST /api/photos/upload
// @access  Private (Admin)
const uploadPhoto = asyncHandler(async (req, res) => {
  try {
    console.log('💡 Fact upload request received');
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

    // Check file size based on media type
    const isVideo = req.file.mimetype.startsWith('video/');
    const maxSize = isVideo ? 5 * 1024 * 1024 * 1024 : 25 * 1024 * 1024; // 5GB for videos, 25MB for images
    if (req.file.size > maxSize) {
      return res.status(413).json({
        success: false,
        message: `File too large. Maximum size is ${isVideo ? '5GB' : '25MB'} for ${isVideo ? 'videos' : 'photos'}.`
      });
    }

    const { title, description, category, tags } = req.body;
    const user = req.user;

    // Create fact document
    const factData = {
      title: title || req.file.originalname,
      description: description || '',
      mediaType: isVideo ? 'video' : 'image',
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

    // Set URL based on media type
    if (isVideo) {
      factData.videoUrl = req.file.path;
      // Generate thumbnail for video (Cloudinary will generate this automatically)
      factData.thumbnailUrl = req.file.path.replace('/upload/', '/upload/w_300,h_200,c_fill,so_0/') + '.jpg';
    } else {
      factData.imageUrl = req.file.path;
      factData.thumbnailUrl = req.file.path.replace('/upload/', '/upload/w_300,h_200,c_fill/');
    }
    
    // Only add schoolId if user has one (admin users don't have schoolId)
    if (user.schoolId || user.school_id) {
      factData.schoolId = user.schoolId || user.school_id;
    }

    console.log('   💾 Saving to database...');
    const fact = await FactOfTheDay.create(factData);
    console.log('   ✅ Fact saved to database:', fact._id);

    res.status(201).json({
      success: true,
      message: 'Fact uploaded successfully',
      data: fact
    });
  } catch (error) {
    console.error('Fact upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Fact upload failed',
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

    const photos = await FactOfTheDay.find(query)
      .populate('uploadedBy', 'name email')
      .populate('schoolId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FactOfTheDay.countDocuments(query);

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
    const fact = await FactOfTheDay.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('schoolId', 'name');

    if (!fact) {
      return res.status(404).json({
        success: false,
        message: 'Fact not found'
      });
    }

    // Check if user has access to this fact
    const user = req.user;
    if (user.role !== 'admin' && fact.schoolId && fact.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment view count
    await fact.incrementViewCount();

    res.json({
      success: true,
      data: fact
    });
  } catch (error) {
    console.error('Get fact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fact',
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

    const fact = await FactOfTheDay.findById(req.params.id);

    if (!fact) {
      return res.status(404).json({
        success: false,
        message: 'Fact not found'
      });
    }

    // Check if user has access to this fact
    if (user.role !== 'admin' && fact.schoolId && fact.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update fields
    if (title) fact.title = title;
    if (description !== undefined) fact.description = description;
    if (category) fact.category = category;
    if (tags) fact.tags = Array.isArray(tags) ? tags : tags.split(',');
    if (isPublic !== undefined) fact.isPublic = isPublic;

    await fact.save();

    res.json({
      success: true,
      message: 'Fact updated successfully',
      data: fact
    });
  } catch (error) {
    console.error('Update fact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fact',
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

    const fact = await FactOfTheDay.findById(req.params.id);

    if (!fact) {
      return res.status(404).json({
        success: false,
        message: 'Fact not found'
      });
    }

    // Check if user has access to this fact
    if (user.role !== 'admin' && fact.schoolId && fact.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete from Cloudinary
    if (fact.cloudinaryId) {
      try {
        const resourceType = fact.mediaType === 'video' ? 'video' : 'image';
        await uploadToCloudinary.deleteResource(fact.cloudinaryId, resourceType);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Delete from database
    await FactOfTheDay.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Fact deleted successfully'
    });
  } catch (error) {
    console.error('Delete fact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fact',
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

    const categories = await FactOfTheDay.distinct('category', query);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get fact categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fact categories',
      error: error.message
    });
  }
});

// @desc    Get fact tags
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

    const tags = await FactOfTheDay.distinct('tags', query);

    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    console.error('Get fact tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fact tags',
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
