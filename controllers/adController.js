const Ad = require('../models/Ad');
const { uploadToCloudinary } = require('../utils/cloudinary');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Upload an ad
// @route   POST /api/ads/upload
// @access  Private (Admin)
const uploadAd = asyncHandler(async (req, res) => {
  try {
    console.log('📢 Ad upload request received');
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
        message: 'File too large. Maximum size is 25MB for ads.'
      });
    }

    const { title, description, category, tags, linkUrl, priority, position, startDate, endDate } = req.body;
    const user = req.user;

    // Create ad document
    const adData = {
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
      linkUrl: linkUrl || '',
      priority: priority ? parseInt(priority) : 0,
      position: position || 'banner',
      startDate: startDate || new Date(),
      endDate: endDate || null,
      width: req.file.width || 0,
      height: req.file.height || 0
    };
    
    // Only add schoolId if user has one (admin users don't have schoolId)
    if (user.schoolId || user.school_id) {
      adData.schoolId = user.schoolId || user.school_id;
    }

    console.log('   💾 Saving to database...');
    const ad = await Ad.create(adData);
    console.log('   ✅ Ad saved to database:', ad._id);

    res.status(201).json({
      success: true,
      message: 'Ad uploaded successfully',
      data: ad
    });
  } catch (error) {
    console.error('Ad upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Ad upload failed',
      error: error.message
    });
  }
});

// @desc    Get all ads
// @route   GET /api/ads
// @access  Private (Admin)
const getAds = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, tags } = req.query;
    const user = req.user;

    let query = { isActive: true };

    // If user is not admin, show ads from their school OR ads without schoolId (admin-created global ads)
    if (user.role !== 'admin') {
      query.$or = [
        { schoolId: user.schoolId || user.school_id },
        { schoolId: { $exists: false } }, // Admin-created global ads
        { schoolId: null } // Admin-created global ads
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

    const ads = await Ad.find(query)
      .populate('uploadedBy', 'name email')
      .populate('schoolId', 'name')
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Ad.countDocuments(query);

    res.json({
      success: true,
      data: ads,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ads',
      error: error.message
    });
  }
});

// @desc    Get ad by ID
// @route   GET /api/ads/:id
// @access  Private (Admin)
const getAd = asyncHandler(async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('schoolId', 'name');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if user has access to this ad
    const user = req.user;
    if (user.role !== 'admin' && ad.schoolId && ad.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment view count
    await ad.incrementViewCount();

    res.json({
      success: true,
      data: ad
    });
  } catch (error) {
    console.error('Get ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad',
      error: error.message
    });
  }
});

// @desc    Update ad
// @route   PUT /api/ads/:id
// @access  Private (Admin)
const updateAd = asyncHandler(async (req, res) => {
  try {
    const { title, description, category, tags, isPublic, linkUrl, priority, position, startDate, endDate } = req.body;
    const user = req.user;

    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if user has access to this ad
    if (user.role !== 'admin' && ad.schoolId && ad.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update fields
    if (title) ad.title = title;
    if (description !== undefined) ad.description = description;
    if (category) ad.category = category;
    if (tags) ad.tags = Array.isArray(tags) ? tags : tags.split(',');
    if (isPublic !== undefined) ad.isPublic = isPublic;
    if (linkUrl !== undefined) ad.linkUrl = linkUrl;
    if (priority !== undefined) ad.priority = priority;
    if (position) ad.position = position;
    if (startDate) ad.startDate = startDate;
    if (endDate !== undefined) ad.endDate = endDate;

    await ad.save();

    res.json({
      success: true,
      message: 'Ad updated successfully',
      data: ad
    });
  } catch (error) {
    console.error('Update ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ad',
      error: error.message
    });
  }
});

// @desc    Delete ad
// @route   DELETE /api/ads/:id
// @access  Private (Admin)
const deleteAd = asyncHandler(async (req, res) => {
  try {
    const user = req.user;

    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if user has access to this ad
    if (user.role !== 'admin' && ad.schoolId && ad.schoolId.toString() !== (user.schoolId || user.school_id).toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete from Cloudinary
    if (ad.cloudinaryId) {
      try {
        await uploadToCloudinary.deleteResource(ad.cloudinaryId);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Delete from database
    await Ad.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Ad deleted successfully'
    });
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ad',
      error: error.message
    });
  }
});

// @desc    Get ad categories
// @route   GET /api/ads/categories
// @access  Private (Admin)
const getAdCategories = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    let query = { isActive: true };

    // If user is not admin, filter by school
    if (user.role !== 'admin') {
      query.schoolId = user.schoolId || user.school_id;
    }

    const categories = await Ad.distinct('category', query);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get ad categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad categories',
      error: error.message
    });
  }
});

// @desc    Get ad tags
// @route   GET /api/ads/tags
// @access  Private (Admin)
const getAdTags = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    let query = { isActive: true };

    // If user is not admin, filter by school
    if (user.role !== 'admin') {
      query.schoolId = user.schoolId || user.school_id;
    }

    const tags = await Ad.distinct('tags', query);

    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    console.error('Get ad tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ad tags',
      error: error.message
    });
  }
});

module.exports = {
  uploadAd,
  getAds,
  getAd,
  updateAd,
  deleteAd,
  getAdCategories,
  getAdTags
};

