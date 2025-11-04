const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getBookBorrowings,
  getBookBorrowing,
  borrowBook,
  returnBook,
  updateBookBorrowing,
  deleteBookBorrowing
} = require('../controllers/bookBorrowingController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Book borrowing management routes (School Admin, Teachers, and Librarians)
router.get('/', authorize('school_admin', 'teacher', 'librarian'), getBookBorrowings);
router.get('/:id', authorize('school_admin', 'teacher', 'librarian'), getBookBorrowing);
router.post('/', authorize('school_admin', 'teacher', 'librarian'), borrowBook);
router.put('/:id/return', authorize('school_admin', 'teacher', 'librarian'), returnBook);
router.put('/:id', authorize('school_admin', 'teacher', 'librarian'), updateBookBorrowing);
router.delete('/:id', authorize('school_admin', 'teacher', 'librarian'), deleteBookBorrowing);

module.exports = router;

