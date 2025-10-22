const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee is required']
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  designation: {
    type: String,
    required: [true, 'Designation is required'],
    trim: true,
    maxlength: [100, 'Designation cannot exceed 100 characters']
  },
  basicSalary: {
    type: Number,
    required: [true, 'Basic salary is required'],
    min: [0, 'Basic salary cannot be negative']
  },
  allowances: {
    houseRent: {
      type: Number,
      default: 0,
      min: [0, 'House rent allowance cannot be negative']
    },
    medical: {
      type: Number,
      default: 0,
      min: [0, 'Medical allowance cannot be negative']
    },
    transport: {
      type: Number,
      default: 0,
      min: [0, 'Transport allowance cannot be negative']
    },
    other: {
      type: Number,
      default: 0,
      min: [0, 'Other allowance cannot be negative']
    }
  },
  deductions: {
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax deduction cannot be negative']
    },
    insurance: {
      type: Number,
      default: 0,
      min: [0, 'Insurance deduction cannot be negative']
    },
    loan: {
      type: Number,
      default: 0,
      min: [0, 'Loan deduction cannot be negative']
    },
    other: {
      type: Number,
      default: 0,
      min: [0, 'Other deduction cannot be negative']
    }
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: [1, 'Month must be between 1 and 12'],
    max: [12, 'Month must be between 1 and 12']
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2020, 'Year must be 2020 or later']
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  paymentDate: {
    type: Date,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'online'],
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
salarySchema.index({ employee: 1, month: 1, year: 1 });
salarySchema.index({ schoolId: 1, status: 1 });
salarySchema.index({ month: 1, year: 1 });

// Virtual for total allowances
salarySchema.virtual('totalAllowances').get(function() {
  return (
    (this.allowances.houseRent || 0) +
    (this.allowances.medical || 0) +
    (this.allowances.transport || 0) +
    (this.allowances.other || 0)
  );
});

// Virtual for total deductions
salarySchema.virtual('totalDeductions').get(function() {
  return (
    (this.deductions.tax || 0) +
    (this.deductions.insurance || 0) +
    (this.deductions.loan || 0) +
    (this.deductions.other || 0)
  );
});

// Virtual for gross salary (basic + allowances)
salarySchema.virtual('grossSalary').get(function() {
  return this.basicSalary + this.totalAllowances;
});

// Virtual for net salary (gross - deductions)
salarySchema.virtual('netSalary').get(function() {
  return this.grossSalary - this.totalDeductions;
});

// Compound unique index to prevent duplicate salary entries for same employee, month, and year
salarySchema.index({ employee: 1, month: 1, year: 1, schoolId: 1 }, { unique: true });

// Pre-save middleware to validate dates
salarySchema.pre('save', function(next) {
  // If status is paid, ensure payment date is set
  if (this.status === 'paid' && !this.paymentDate) {
    this.paymentDate = new Date();
  }
  
  // If status is changed from paid to something else, clear payment date
  if (this.status !== 'paid' && this.paymentDate) {
    this.paymentDate = null;
    this.paymentMethod = null;
  }
  
  next();
});

// Static method to get salary statistics for a school
salarySchema.statics.getSchoolStats = async function(schoolId, month = null, year = null) {
  const match = { schoolId, isActive: true };
  
  if (month !== null) match.month = month;
  if (year !== null) match.year = year;
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalBasicSalary: { $sum: '$basicSalary' },
        totalAllowances: {
          $sum: {
            $add: [
              { $ifNull: ['$allowances.houseRent', 0] },
              { $ifNull: ['$allowances.medical', 0] },
              { $ifNull: ['$allowances.transport', 0] },
              { $ifNull: ['$allowances.other', 0] }
            ]
          }
        },
        totalDeductions: {
          $sum: {
            $add: [
              { $ifNull: ['$deductions.tax', 0] },
              { $ifNull: ['$deductions.insurance', 0] },
              { $ifNull: ['$deductions.loan', 0] },
              { $ifNull: ['$deductions.other', 0] }
            ]
          }
        },
        totalPaid: {
          $sum: {
            $cond: [{ $eq: ['$status', 'paid'] }, 1, 0]
          }
        },
        totalPending: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalEmployees: 0,
      totalBasicSalary: 0,
      totalAllowances: 0,
      totalDeductions: 0,
      totalGrossSalary: 0,
      totalNetSalary: 0,
      totalPaid: 0,
      totalPending: 0
    };
  }
  
  const result = stats[0];
  result.totalGrossSalary = result.totalBasicSalary + result.totalAllowances;
  result.totalNetSalary = result.totalGrossSalary - result.totalDeductions;
  
  return result;
};

// Static method to get salary by employee, month, and year
salarySchema.statics.findByEmployeeMonthYear = function(employeeId, month, year) {
  return this.findOne({
    employee: employeeId,
    month,
    year,
    isActive: true
  }).populate('employee', 'name email phone');
};

// Static method to mark salary as paid
salarySchema.methods.markAsPaid = function(paymentMethod = 'bank_transfer') {
  this.status = 'paid';
  this.paymentDate = new Date();
  this.paymentMethod = paymentMethod;
  return this.save();
};

module.exports = mongoose.model('Salary', salarySchema);

