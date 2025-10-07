const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  schoolName: {
    type: String,
    required: [true, 'School name is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Bill amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending',
    required: true
  },
  invoiceNumber: {
    type: String,
    unique: true,
    required: [true, 'Invoice number is required'],
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    required: [true, 'Bill description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Bill category is required'],
    enum: ['subscription', 'feature_upgrade', 'support', 'custom', 'penalty'],
    default: 'subscription'
  },
  billingPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  items: [{
    description: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative']
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative']
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    rate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%']
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative']
    }
  },
  discount: {
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed'
    },
    value: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative']
    }
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD',
    maxlength: [3, 'Currency code cannot exceed 3 characters']
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'check', 'cash', 'online', 'pending'],
    default: 'pending'
  },
  paymentDetails: {
    transactionId: {
      type: String,
      trim: true
    },
    paymentDate: {
      type: Date,
      default: null
    },
    paymentReference: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  reminders: [{
    sentDate: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['email', 'sms', 'system'],
      required: true
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending'],
      default: 'sent'
    }
  }],
  lateFees: {
    enabled: {
      type: Boolean,
      default: false
    },
    rate: {
      type: Number,
      default: 0,
      min: [0, 'Late fee rate cannot be negative']
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Late fee amount cannot be negative']
    },
    appliedDate: {
      type: Date,
      default: null
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
billSchema.index({ school: 1 });
billSchema.index({ invoiceNumber: 1 });
billSchema.index({ status: 1 });
billSchema.index({ dueDate: 1 });
billSchema.index({ category: 1 });
billSchema.index({ 'billingPeriod.startDate': 1 });
billSchema.index({ 'billingPeriod.endDate': 1 });

// Virtual for days overdue
billSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'overdue') return 0;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = now - due;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for payment status
billSchema.virtual('paymentStatus').get(function() {
  if (this.status === 'paid') return 'paid';
  if (this.status === 'cancelled') return 'cancelled';
  
  const now = new Date();
  const due = new Date(this.dueDate);
  
  if (now > due) return 'overdue';
  return 'pending';
});

// Virtual for total with late fees
billSchema.virtual('totalWithLateFees').get(function() {
  return this.total + this.lateFees.amount;
});

// Pre-save middleware to generate invoice number
billSchema.pre('save', function(next) {
  if (!this.invoiceNumber) {
    const prefix = 'INV';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.invoiceNumber = `${prefix}-${year}${month}-${random}`;
  }
  
  // Calculate totals
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate tax
  this.tax.amount = this.subtotal * (this.tax.rate / 100);
  
  // Calculate discount
  if (this.discount.type === 'percentage') {
    this.discount.amount = this.subtotal * (this.discount.value / 100);
  } else {
    this.discount.amount = this.discount.value;
  }
  
  // Calculate total
  this.total = this.subtotal + this.tax.amount - this.discount.amount;
  
  // Update status based on due date
  if (this.status === 'pending' && new Date() > this.dueDate) {
    this.status = 'overdue';
  }
  
  next();
});

// Static method to get bills by school
billSchema.statics.getBillsBySchool = function(schoolId) {
  return this.find({ school: schoolId })
    .populate('school', 'name code')
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email');
};

// Static method to get overdue bills
billSchema.statics.getOverdueBills = function() {
  return this.find({ 
    status: 'overdue',
    dueDate: { $lt: new Date() }
  }).populate('school', 'name code contact');
};

// Static method to get bills by status
billSchema.statics.getBillsByStatus = function(status) {
  return this.find({ status }).populate('school', 'name code');
};

// Static method to get bills by date range
billSchema.statics.getBillsByDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).populate('school', 'name code');
};

// Static method to get revenue summary
billSchema.statics.getRevenueSummary = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        status: 'paid',
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$total' },
        totalBills: { $sum: 1 },
        averageBillAmount: { $avg: '$total' }
      }
    }
  ]);
};

// Instance method to mark as paid
billSchema.methods.markAsPaid = function(paymentDetails) {
  this.status = 'paid';
  this.paymentDetails = {
    ...this.paymentDetails,
    ...paymentDetails,
    paymentDate: new Date()
  };
  return this.save();
};

// Instance method to apply late fees
billSchema.methods.applyLateFees = function() {
  if (this.status === 'overdue' && this.lateFees.enabled && !this.lateFees.appliedDate) {
    const daysOverdue = this.daysOverdue;
    this.lateFees.amount = this.total * (this.lateFees.rate / 100) * daysOverdue;
    this.lateFees.appliedDate = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to send reminder
billSchema.methods.sendReminder = function(type) {
  this.reminders.push({
    sentDate: new Date(),
    type: type,
    status: 'sent'
  });
  return this.save();
};

// Instance method to cancel bill
billSchema.methods.cancelBill = function(reason) {
  this.status = 'cancelled';
  this.notes = (this.notes || '') + `\nCancelled: ${reason}`;
  return this.save();
};

module.exports = mongoose.model('Bill', billSchema);
