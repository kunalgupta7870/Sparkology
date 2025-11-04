const express = require('express');
const router = express.Router();
const {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  toggleLike
} = require('../controllers/coCurricularController');
const { protect, authorize } = require('../middleware/auth');
const { uploadCoCurricularImages, handleUploadError } = require('../utils/cloudinary');

// All routes require authentication and student role
router.use(protect);
router.use(authorize('student'));

// Get all posts from classmates
router.get('/', getPosts);

// Get single post
router.get('/:id', getPost);

// Create new post (with optional images) - direct Cloudinary upload
router.post('/', uploadCoCurricularImages.array('images', 10), handleUploadError, createPost);

// Update post (only creator can update) - direct Cloudinary upload
router.put('/:id', uploadCoCurricularImages.array('images', 10), handleUploadError, updatePost);

// Delete post (only creator can delete)
router.delete('/:id', deletePost);

// Like/Unlike post
router.put('/:id/like', toggleLike);

module.exports = router;

