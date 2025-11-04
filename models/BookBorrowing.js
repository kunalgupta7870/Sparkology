const mongoose = require('mongoose');

const bookBorrowingSchema = new mongoose.Schema({
  // Book Reference
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: [true, 'Book ID is required']
  },
  
  // Student Reference
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required']
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Borrowing Information
  borrowDate: {
    type: Date,
    required: [true, 'Borrow date is required'],
    default: Date.now
  },
  returnDate: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    default: null
  },
  
  // Status
  status: {
    type: String,
    enum: ['borrowed', 'returned'],
    default: 'borrowed'
  },
  
  // Additional Information
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
bookBorrowingSchema.index({ bookId: 1 });
bookBorrowingSchema.index({ studentId: 1 });
bookBorrowingSchema.index({ schoolId: 1 });
bookBorrowingSchema.index({ status: 1 });
bookBorrowingSchema.index({ borrowDate: -1 });

module.exports = mongoose.model('BookBorrowing', bookBorrowingSchema);

