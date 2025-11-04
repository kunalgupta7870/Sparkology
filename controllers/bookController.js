const Book = require('../models/Book');
const BookBorrowing = require('../models/BookBorrowing');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all books for a school
// @route   GET /api/books
// @access  Private
exports.getBooks = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const books = await Book.find({ schoolId, status: 'active' })
    .sort({ createdAt: -1 });
  
  // Calculate available books for each book
  const booksWithAvailability = await Promise.all(
    books.map(async (book) => {
      const borrowedCount = await BookBorrowing.countDocuments({
        bookId: book._id,
        status: 'borrowed'
      });
      
      return {
        ...book.toObject(),
        available: book.quantity - borrowedCount
      };
    })
  );
  
  res.status(200).json({
    success: true,
    count: booksWithAvailability.length,
    data: booksWithAvailability
  });
});

// @desc    Get single book
// @route   GET /api/books/:id
// @access  Private
exports.getBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  
  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found'
    });
  }
  
  // Calculate available books
  const borrowedCount = await BookBorrowing.countDocuments({
    bookId: book._id,
    status: 'borrowed'
  });
  
  const bookWithAvailability = {
    ...book.toObject(),
    available: book.quantity - borrowedCount
  };
  
  res.status(200).json({
    success: true,
    data: bookWithAvailability
  });
});

// @desc    Create new book
// @route   POST /api/books
// @access  Private
exports.createBook = asyncHandler(async (req, res) => {
  const book = await Book.create(req.body);
  
  res.status(201).json({
    success: true,
    message: 'Book created successfully',
    data: book
  });
});

// @desc    Update book
// @route   PUT /api/books/:id
// @access  Private
exports.updateBook = asyncHandler(async (req, res) => {
  let book = await Book.findById(req.params.id);
  
  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found'
    });
  }
  
  book = await Book.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  // Calculate available books
  const borrowedCount = await BookBorrowing.countDocuments({
    bookId: book._id,
    status: 'borrowed'
  });
  
  const bookWithAvailability = {
    ...book.toObject(),
    available: book.quantity - borrowedCount
  };
  
  res.status(200).json({
    success: true,
    message: 'Book updated successfully',
    data: bookWithAvailability
  });
});

// @desc    Delete book
// @route   DELETE /api/books/:id
// @access  Private
exports.deleteBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  
  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found'
    });
  }
  
  // Check if there are any active borrowings
  const activeBorrowings = await BookBorrowing.countDocuments({
    bookId: book._id,
    status: 'borrowed'
  });
  
  if (activeBorrowings > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete book. There are ${activeBorrowings} active borrowings. Please return all books first.`
    });
  }
  
  // Soft delete by setting status to inactive
  book.status = 'inactive';
  await book.save();
  
  res.status(200).json({
    success: true,
    message: 'Book deleted successfully'
  });
});

