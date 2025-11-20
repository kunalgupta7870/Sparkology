const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  // Book Information
  name: {
    type: String,
    required: [true, 'Book name is required'],
    trim: true,
    maxlength: [200, 'Book name cannot exceed 200 characters']
  },
  author: {
    type: String,
    trim: true,
    maxlength: [200, 'Author name cannot exceed 200 characters']
  },
  isbn: {
    type: String,
    trim: true,
    maxlength: [50, 'ISBN cannot exceed 50 characters']
  },
  category: {
    type: String,
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to calculate available books (quantity - borrowed books)
bookSchema.virtual('available').get(function() {
  // This will be calculated dynamically in the controller
  return this.quantity;
});

// Indexes for better query performance
bookSchema.index({ schoolId: 1 });
bookSchema.index({ name: 1 });
bookSchema.index({ status: 1 });

module.exports = mongoose.model('Book', bookSchema);

