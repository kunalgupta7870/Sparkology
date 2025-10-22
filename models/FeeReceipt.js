const mongoose = require('mongoose');

const feeReceiptSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  receiptNumber: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
    // Note: Not required here because it's auto-generated in pre-save middleware
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required']
  },
  feeCollection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeCollection',
    required: [true, 'Fee collection ID is required']
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
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'cheque', 'online', 'card', 'bank_transfer'],
    required: [true, 'Payment method is required']
  },
  transactionId: {
    type: String,
    trim: true
  },
  chequeNumber: {
    type: String,
    trim: true
  },
  chequeDate: {
    type: Date
  },
  bankName: {
    type: String,
    trim: true
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
feeReceiptSchema.index({ school: 1 });
feeReceiptSchema.index({ student: 1 });
feeReceiptSchema.index({ receiptNumber: 1 });
feeReceiptSchema.index({ feeCollection: 1 });
feeReceiptSchema.index({ status: 1 });
feeReceiptSchema.index({ academicYear: 1 });
feeReceiptSchema.index({ paymentDate: 1 });

// Pre-save middleware to generate receipt number
feeReceiptSchema.pre('save', async function(next) {
  if (!this.receiptNumber || this.receiptNumber === '') {
    const prefix = 'RCP';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    try {
      // Get the count of receipts for this school in this month
      const count = await this.constructor.countDocuments({
        school: this.school,
        createdAt: {
          $gte: new Date(year, new Date().getMonth(), 1),
          $lt: new Date(year, new Date().getMonth() + 1, 1)
        }
      });
      
      const sequence = String(count + 1).padStart(4, '0');
      this.receiptNumber = `${prefix}-${year}${month}-${sequence}`;
      
      console.log('Generated receipt number:', this.receiptNumber);
    } catch (error) {
      console.error('Error generating receipt number:', error);
      // Fallback to random number if count fails
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.receiptNumber = `${prefix}-${year}${month}-${random}`;
    }
  }
  
  next();
});

// Static method to get receipts by school
feeReceiptSchema.statics.getReceiptsBySchool = function(schoolId, filters = {}) {
  const query = { school: schoolId, status: 'active', ...filters };
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
    .populate('feeCollection', 'totalAmount paidAmount dueAmount')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get receipts by student
feeReceiptSchema.statics.getReceiptsByStudent = function(studentId, academicYear) {
  const query = { student: studentId, status: 'active' };
  if (academicYear) {
    query.academicYear = academicYear;
  }
  return this.find(query)
    .populate({
      path: 'feeStructure',
      select: 'name amount category',
      populate: {
        path: 'category',
        select: 'name'
      }
    })
    .populate('feeCollection', 'totalAmount paidAmount dueAmount')
    .populate('createdBy', 'name email')
    .sort({ paymentDate: -1 });
};

// Static method to get receipts by date range
feeReceiptSchema.statics.getReceiptsByDateRange = function(schoolId, startDate, endDate) {
  return this.find({
    school: schoolId,
    status: 'active',
    paymentDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  })
  .populate({
    path: 'student',
    select: 'name admissionNumber classId email phone',
    populate: {
      path: 'classId',
      select: 'name section'
      }
  })
  .populate('feeStructure', 'name category')
  .sort({ paymentDate: -1 });
};

// Static method to get receipt statistics
feeReceiptSchema.statics.getReceiptStats = function(schoolId, academicYear, startDate, endDate) {
  const matchQuery = { school: schoolId, status: 'active' };
  
  if (academicYear) {
    matchQuery.academicYear = academicYear;
  }
  
  if (startDate && endDate) {
    matchQuery.paymentDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalReceipts: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    }
  ]);
};

// Static method to get receipts by payment method
feeReceiptSchema.statics.getReceiptsByPaymentMethod = function(schoolId, academicYear) {
  const matchQuery = { school: schoolId, status: 'active' };
  
  if (academicYear) {
    matchQuery.academicYear = academicYear;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
};

// Instance method to cancel receipt
feeReceiptSchema.methods.cancelReceipt = function(reason, userId) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  return this.save();
};

module.exports = mongoose.model('FeeReceipt', feeReceiptSchema);

