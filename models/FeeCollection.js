const mongoose = require('mongoose');

const feeCollectionSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required']
  },
  feeStructure: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: [true, 'Fee structure ID is required']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  month: {
    type: String,
    trim: true // For monthly fees: "January 2025", "February 2025", etc.
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },
  lateFeeAmount: {
    type: Number,
    default: 0,
    min: [0, 'Late fee amount cannot be negative']
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  dueAmount: {
    type: Number,
    required: true,
    min: [0, 'Due amount cannot be negative']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  payments: [{
    amount: {
      type: Number,
      required: true,
      min: [0, 'Payment amount cannot be negative']
    },
    paymentDate: {
      type: Date,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'cheque', 'online', 'card', 'bank_transfer'],
      required: true
    },
    transactionId: {
      type: String,
      trim: true
    },
    remarks: {
      type: String,
      trim: true
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  reminders: [{
    sentDate: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['email', 'sms', 'notification'],
      required: true
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending'],
      default: 'sent'
    }
  }],
  remarks: {
    type: String,
    trim: true,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
feeCollectionSchema.index({ school: 1 });
feeCollectionSchema.index({ student: 1 });
feeCollectionSchema.index({ feeStructure: 1 });
feeCollectionSchema.index({ status: 1 });
feeCollectionSchema.index({ dueDate: 1 });
feeCollectionSchema.index({ academicYear: 1 });
feeCollectionSchema.index({ month: 1 });

// Virtual for days overdue
feeCollectionSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'paid' || this.status === 'cancelled') return 0;
  const now = new Date();
  const due = new Date(this.dueDate);
  if (now <= due) return 0;
  const diffTime = now - due;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for final amount (total - discount + late fee)
feeCollectionSchema.virtual('finalAmount').get(function() {
  return this.totalAmount - this.discountAmount + this.lateFeeAmount;
});

// Pre-save middleware to update status and due amount
feeCollectionSchema.pre('save', function(next) {
  // Calculate due amount
  this.dueAmount = this.finalAmount - this.paidAmount;
  
  // Update status based on payment
  if (this.status !== 'cancelled') {
    if (this.paidAmount >= this.finalAmount) {
      this.status = 'paid';
      this.dueAmount = 0;
    } else if (this.paidAmount > 0) {
      this.status = 'partial';
    } else if (new Date() > this.dueDate) {
      this.status = 'overdue';
    } else {
      this.status = 'pending';
    }
  }
  
  next();
});

// Static method to get collections by school
feeCollectionSchema.statics.getCollectionsBySchool = function(schoolId, filters = {}) {
  const query = { school: schoolId, ...filters };
  return this.find(query)
    .populate({
      path: 'student',
      select: 'name admissionNumber classId email phone',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate('feeStructure', 'name amount category')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get collections by student
feeCollectionSchema.statics.getCollectionsByStudent = function(studentId, academicYear) {
  const query = { student: studentId };
  if (academicYear) {
    query.academicYear = academicYear;
  }
  return this.find(query)
    .populate({
      path: 'feeStructure',
      select: 'name amount category frequency',
      populate: {
        path: 'category',
        select: 'name'
      }
    })
    .populate('createdBy', 'name email')
    .sort({ dueDate: 1 });
};

// Static method to get due collections
feeCollectionSchema.statics.getDueCollections = function(schoolId, academicYear) {
  return this.find({
    school: schoolId,
    academicYear,
    status: { $in: ['pending', 'partial', 'overdue'] },
    dueAmount: { $gt: 0 }
  })
  .populate({
    path: 'student',
    select: 'name admissionNumber classId email phone',
    populate: {
      path: 'classId',
      select: 'name section'
    }
  })
  .populate('feeStructure', 'name amount category')
  .sort({ dueDate: 1 });
};

// Static method to get overdue collections
feeCollectionSchema.statics.getOverdueCollections = function(schoolId, academicYear) {
  return this.find({
    school: schoolId,
    academicYear,
    status: 'overdue',
    dueDate: { $lt: new Date() },
    dueAmount: { $gt: 0 }
  })
  .populate({
    path: 'student',
    select: 'name admissionNumber classId email phone parentPhone parentEmail',
    populate: {
      path: 'classId',
      select: 'name section'
    }
  })
  .populate('feeStructure', 'name amount category')
  .sort({ dueDate: 1 });
};

// Static method to get collection statistics
feeCollectionSchema.statics.getCollectionStats = function(schoolId, academicYear, startDate, endDate) {
  const matchQuery = { school: schoolId };
  
  if (academicYear) {
    matchQuery.academicYear = academicYear;
  }
  
  if (startDate && endDate) {
    matchQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalCollections: { $sum: 1 },
        totalAmount: { $sum: '$finalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        totalDue: { $sum: '$dueAmount' },
        averageCollection: { $avg: '$paidAmount' }
      }
    }
  ]);
};

// Instance method to add payment
feeCollectionSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.paidAmount += paymentData.amount;
  return this.save();
};

// Instance method to send reminder
feeCollectionSchema.methods.sendReminder = function(type) {
  this.reminders.push({
    sentDate: new Date(),
    type: type,
    status: 'sent'
  });
  return this.save();
};

// Instance method to cancel collection
feeCollectionSchema.methods.cancelCollection = function(reason) {
  this.status = 'cancelled';
  this.remarks = (this.remarks || '') + `\nCancelled: ${reason}`;
  return this.save();
};

module.exports = mongoose.model('FeeCollection', feeCollectionSchema);

