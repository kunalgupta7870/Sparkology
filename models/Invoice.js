const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  // School and Student Info
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required'],
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
    index: true
  },
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true
  },
  admissionNumber: {
    type: String,
    required: [true, 'Admission number is required'],
    trim: true
  },
  className: {
    type: String,
    trim: true
  },

  // Invoice Details
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    trim: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  },

  // Line Items
  items: [{
    description: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    }
  }],

  // Total Amount
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: 0
  },

  // Payment Status
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },

  // Additional Information
  remarks: {
    type: String,
    trim: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Metadata
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
invoiceSchema.index({ schoolId: 1, studentId: 1 });
invoiceSchema.index({ schoolId: 1, invoiceDate: -1 });
invoiceSchema.index({ schoolId: 1, paymentStatus: 1 });

// Virtual for formatted invoice number
invoiceSchema.virtual('formattedInvoiceNumber').get(function() {
  return this.invoiceNumber;
});

// Virtual for formatted date
invoiceSchema.virtual('formattedInvoiceDate').get(function() {
  if (this.invoiceDate) {
    return this.invoiceDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  return '';
});

// Virtual for formatted due date
invoiceSchema.virtual('formattedDueDate').get(function() {
  if (this.dueDate) {
    return this.dueDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  return '';
});

module.exports = mongoose.model('Invoice', invoiceSchema);
