const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook
} = require('../controllers/bookController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Book management routes (School Admin, Teachers, and Librarians)
router.get('/', authorize('school_admin', 'teacher', 'librarian'), getBooks);
router.get('/:id', authorize('school_admin', 'teacher', 'librarian'), getBook);
router.post('/', authorize('school_admin', 'teacher', 'librarian'), createBook);
router.put('/:id', authorize('school_admin', 'teacher', 'librarian'), updateBook);
router.delete('/:id', authorize('school_admin', 'teacher', 'librarian'), deleteBook);

module.exports = router;

