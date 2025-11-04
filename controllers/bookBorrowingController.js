const BookBorrowing = require('../models/BookBorrowing');
const Book = require('../models/Book');
const Student = require('../models/Student');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all book borrowings for a school
// @route   GET /api/book-borrowings
// @access  Private
exports.getBookBorrowings = asyncHandler(async (req, res) => {
  const { schoolId, status } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const query = { schoolId };
  if (status) {
    query.status = status;
  }
  
  const borrowings = await BookBorrowing.find(query)
    .populate({
      path: 'bookId',
      select: 'name description quantity'
    })
    .populate({
      path: 'studentId',
      select: 'name rollNumber email classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .sort({ borrowDate: -1 });
  
  res.status(200).json({
    success: true,
    count: borrowings.length,
    data: borrowings
  });
});

// @desc    Get single book borrowing
// @route   GET /api/book-borrowings/:id
// @access  Private
exports.getBookBorrowing = asyncHandler(async (req, res) => {
  const borrowing = await BookBorrowing.findById(req.params.id)
    .populate({
      path: 'bookId',
      select: 'name description quantity'
    })
    .populate({
      path: 'studentId',
      select: 'name rollNumber email classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    });
  
  if (!borrowing) {
    return res.status(404).json({
      success: false,
      message: 'Borrowing record not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: borrowing
  });
});

// @desc    Borrow a book
// @route   POST /api/book-borrowings
// @access  Private
exports.borrowBook = asyncHandler(async (req, res) => {
  const { bookId, studentId, schoolId, borrowDate, dueDate, notes } = req.body;
  
  // Validate required fields
  if (!bookId || !studentId || !schoolId) {
    return res.status(400).json({
      success: false,
      message: 'Book ID, Student ID, and School ID are required'
    });
  }
  
  // Check if book exists
  const book = await Book.findById(bookId);
  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found'
    });
  }
  
  // Check if student exists
  const student = await Student.findById(studentId);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }
  
  // Check if book has available copies
  const borrowedCount = await BookBorrowing.countDocuments({
    bookId,
    status: 'borrowed'
  });
  
  if (borrowedCount >= book.quantity) {
    return res.status(400).json({
      success: false,
      message: 'No available copies of this book'
    });
  }
  
  // Check if student already borrowed this book and hasn't returned it
  const existingBorrowing = await BookBorrowing.findOne({
    bookId,
    studentId,
    status: 'borrowed'
  });
  
  if (existingBorrowing) {
    return res.status(400).json({
      success: false,
      message: 'Student has already borrowed this book. Please return it first.'
    });
  }
  
  // Create borrowing record
  const borrowing = await BookBorrowing.create({
    bookId,
    studentId,
    schoolId,
    borrowDate: borrowDate || new Date(),
    dueDate,
    status: 'borrowed',
    notes
  });
  
  const populatedBorrowing = await BookBorrowing.findById(borrowing._id)
    .populate({
      path: 'bookId',
      select: 'name description quantity'
    })
    .populate({
      path: 'studentId',
      select: 'name rollNumber email classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    });
  
  res.status(201).json({
    success: true,
    message: 'Book borrowed successfully',
    data: populatedBorrowing
  });
});

// @desc    Return a book
// @route   PUT /api/book-borrowings/:id/return
// @access  Private
exports.returnBook = asyncHandler(async (req, res) => {
  const { returnDate, notes } = req.body;
  
  const borrowing = await BookBorrowing.findById(req.params.id);
  
  if (!borrowing) {
    return res.status(404).json({
      success: false,
      message: 'Borrowing record not found'
    });
  }
  
  if (borrowing.status === 'returned') {
    return res.status(400).json({
      success: false,
      message: 'Book has already been returned'
    });
  }
  
  // Update borrowing record
  borrowing.returnDate = returnDate || new Date();
  borrowing.status = 'returned';
  if (notes) {
    borrowing.notes = notes;
  }
  await borrowing.save();
  
  const populatedBorrowing = await BookBorrowing.findById(borrowing._id)
    .populate({
      path: 'bookId',
      select: 'name description quantity'
    })
    .populate({
      path: 'studentId',
      select: 'name rollNumber email classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    });
  
  res.status(200).json({
    success: true,
    message: 'Book returned successfully',
    data: populatedBorrowing
  });
});

// @desc    Update book borrowing
// @route   PUT /api/book-borrowings/:id
// @access  Private
exports.updateBookBorrowing = asyncHandler(async (req, res) => {
  let borrowing = await BookBorrowing.findById(req.params.id);
  
  if (!borrowing) {
    return res.status(404).json({
      success: false,
      message: 'Borrowing record not found'
    });
  }
  
  borrowing = await BookBorrowing.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
    .populate({
      path: 'bookId',
      select: 'name description quantity'
    })
    .populate({
      path: 'studentId',
      select: 'name rollNumber email classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    });
  
  res.status(200).json({
    success: true,
    message: 'Borrowing record updated successfully',
    data: borrowing
  });
});

// @desc    Delete book borrowing
// @route   DELETE /api/book-borrowings/:id
// @access  Private
exports.deleteBookBorrowing = asyncHandler(async (req, res) => {
  const borrowing = await BookBorrowing.findById(req.params.id);
  
  if (!borrowing) {
    return res.status(404).json({
      success: false,
      message: 'Borrowing record not found'
    });
  }
  
  if (borrowing.status === 'borrowed') {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete active borrowing. Please return the book first.'
    });
  }
  
  await borrowing.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Borrowing record deleted successfully'
  });
});

