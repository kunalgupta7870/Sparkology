const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
  studentName: { 
    type: String, 
    required: [true, 'Student name is required'], 
    trim: true 
  },
  dateOfBirth: { 
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: { 
    type: String, 
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required']
  },
  classApplied: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true
  },
  parentDetails: {
    name: { 
      type: String,
      required: [true, 'Parent name is required']
    },
    relation: {
      type: String,
      enum: ['father', 'mother', 'guardian'],
      required: true
    },
    occupation: String,
    contact: { 
      type: String,
      required: [true, 'Contact number is required']
    },
    email: { 
      type: String, 
      lowercase: true, 
      trim: true,
      required: [true, 'Email is required']
    }
  },
  address: {
    street: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  },
  previousSchool: {
    name: String,
    board: String,
    percentage: Number,
    leavingReason: String
  },
  documents: [{
    type: { 
      type: String, 
      enum: ['birth_certificate', 'transfer_certificate', 'marksheet', 'other'],
      required: true
    },
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  status: { 
    type: String, 
    enum: ['pending', 'under_review', 'approved', 'rejected', 'waitlisted'],
    default: 'pending'
  },
  applicationNumber: {
    type: String,
    unique: true
  },
  remarks: [{
    comment: String,
    commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commentedAt: { type: Date, default: Date.now }
  }],
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

// Indexes for faster queries
admissionSchema.index({ schoolId: 1, status: 1, isActive: 1 });
admissionSchema.index({ applicationNumber: 1 });
admissionSchema.index({ 'parentDetails.email': 1 });

// Generate application number before saving
admissionSchema.pre('save', async function(next) {
  if (!this.applicationNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('AdmissionApplication').countDocuments({
      schoolId: this.schoolId,
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.applicationNumber = `ADM-${year}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('AdmissionApplication', admissionSchema);
