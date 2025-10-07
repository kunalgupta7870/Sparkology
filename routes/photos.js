const express = require('express');
const router = express.Router();
const {
  uploadPhoto,
  getPhotos,
  getPhoto,
  updatePhoto,
  deletePhoto,
  getPhotoCategories,
  getPhotoTags
} = require('../controllers/photoController');
const { protect, authorize } = require('../middleware/auth');
const { uploadPhoto: uploadPhotoMiddleware, handleUploadError } = require('../utils/cloudinary');
const { body, param } = require('express-validator');

// Validation middleware
const validatePhotoUpload = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
        } catch (e) {
          throw new Error('Tags must be a valid JSON array');
        }
      }
      return true;
    })
];

const validatePhotoUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('tags')
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        return value.every(tag => typeof tag === 'string' && tag.length <= 50);
      }
      return true;
    })
    .withMessage('Tags must be an array of strings, each max 50 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

const validatePhotoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid photo ID')
];

// All routes require authentication
router.use(protect);

// @route   POST /api/photos/upload
// @desc    Upload a photo
// @access  Private (Admin)
router.post('/upload', 
  authorize(['admin']),
  uploadPhotoMiddleware.single('file'),
  // validatePhotoUpload, // Temporarily disabled
  handleUploadError,
  uploadPhoto
);

// @route   GET /api/photos
// @desc    Get all photos
// @access  Private (Admin, Students, Teachers, Parents)
router.get('/', authorize(['admin', 'student', 'teacher', 'parent', 'school_admin']), getPhotos);

// @route   GET /api/photos/categories
// @desc    Get photo categories
// @access  Private (Admin)
router.get('/categories', authorize(['admin']), getPhotoCategories);

// @route   GET /api/photos/tags
// @desc    Get photo tags
// @access  Private (Admin)
router.get('/tags', authorize(['admin']), getPhotoTags);

// @route   GET /api/photos/:id
// @desc    Get photo by ID
// @access  Private (Admin)
router.get('/:id', 
  authorize(['admin']),
  validatePhotoId,
  getPhoto
);

// @route   PUT /api/photos/:id
// @desc    Update photo
// @access  Private (Admin)
router.put('/:id',
  authorize(['admin']),
  validatePhotoId,
  validatePhotoUpdate,
  updatePhoto
);

// @route   DELETE /api/photos/:id
// @desc    Delete photo
// @access  Private (Admin)
router.delete('/:id',
  authorize(['admin']),
  validatePhotoId,
  deletePhoto
);

module.exports = router;
