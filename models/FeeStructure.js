const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  name: {
    type: String,
    required: [true, 'Fee structure name is required'],
    trim: true,
    maxlength: [100, 'Fee name cannot exceed 100 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeCategory',
    required: [true, 'Fee category is required']
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null // null means applies to all classes
  },
  amount: {
    type: Number,
    required: [true, 'Fee amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  frequency: {
    type: String,
    enum: ['one-time', 'monthly', 'quarterly', 'semi-annual', 'annual'],
    default: 'monthly',
    required: true
  },
  dueDay: {
    type: Number,
    min: [1, 'Due day must be between 1 and 31'],
    max: [31, 'Due day must be between 1 and 31'],
    default: 1 // Day of month when fee is due
  },
  lateFee: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed'
    },
    value: {
      type: Number,
      default: 0,
      min: [0, 'Late fee value cannot be negative']
    },
    gracePeriod: {
      type: Number,
      default: 0, // Days after due date before late fee applies
      min: [0, 'Grace period cannot be negative']
    }
  },
  discount: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'percentage'
    },
    value: {
      type: Number,
      default: 0,
      min: [0, 'Discount value cannot be negative']
    },
    description: {
      type: String,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
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
feeStructureSchema.index({ school: 1 });
feeStructureSchema.index({ class: 1 });
feeStructureSchema.index({ category: 1 });
feeStructureSchema.index({ status: 1 });
feeStructureSchema.index({ academicYear: 1 });

// Static method to get fee structures by school
feeStructureSchema.statics.getFeeStructuresBySchool = function(schoolId, academicYear) {
  const query = { school: schoolId };
  if (academicYear) {
    query.academicYear = academicYear;
  }
  return this.find(query)
    .populate('category', 'name description')
    .populate('class', 'name section')
    .populate('createdBy', 'name email')
    .sort({ name: 1 });
};

// Static method to get active fee structures
feeStructureSchema.statics.getActiveFeeStructures = function(schoolId, classId, academicYear) {
  const query = { 
    school: schoolId, 
    status: 'active',
    academicYear 
  };
  
  if (classId) {
    query.$or = [
      { class: classId },
      { class: null } // Include fees that apply to all classes
    ];
  }
  
  return this.find(query)
    .populate('category', 'name description')
    .populate('class', 'name section')
    .sort({ name: 1 });
};

// Static method to get fee structures by class
feeStructureSchema.statics.getFeeStructuresByClass = function(schoolId, classId, academicYear) {
  return this.find({
    school: schoolId,
    $or: [
      { class: classId },
      { class: null }
    ],
    academicYear,
    status: 'active'
  })
  .populate('category', 'name description')
  .populate('class', 'name section');
};

// Instance method to calculate late fee
feeStructureSchema.methods.calculateLateFee = function(daysLate) {
  if (!this.lateFee.enabled || daysLate <= this.lateFee.gracePeriod) {
    return 0;
  }
  
  const effectiveDaysLate = daysLate - this.lateFee.gracePeriod;
  
  if (this.lateFee.type === 'percentage') {
    return (this.amount * this.lateFee.value / 100) * effectiveDaysLate;
  } else {
    return this.lateFee.value * effectiveDaysLate;
  }
};

// Instance method to calculate discount
feeStructureSchema.methods.calculateDiscount = function() {
  if (!this.discount.enabled) {
    return 0;
  }
  
  if (this.discount.type === 'percentage') {
    return this.amount * this.discount.value / 100;
  } else {
    return this.discount.value;
  }
};

// Instance method to get final amount
feeStructureSchema.methods.getFinalAmount = function() {
  const discount = this.calculateDiscount();
  return this.amount - discount;
};

module.exports = mongoose.model('FeeStructure', feeStructureSchema);

