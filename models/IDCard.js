const mongoose = require('mongoose');

const idCardSchema = new mongoose.Schema({
  // Person information
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Person ID is required'],
    refPath: 'personModel'
  },
  personModel: {
    type: String,
    required: true,
    enum: ['Student', 'User'] // User for teachers
  },
  personName: {
    type: String,
    required: [true, 'Person name is required']
  },
  personEmail: {
    type: String,
    required: [true, 'Person email is required']
  },
  
  // School information
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  schoolName: {
    type: String,
    required: [true, 'School name is required']
  },
  
  // ID Card details
  idNumber: {
    type: String,
    required: [true, 'ID number is required'],
    trim: true
  },
  classOrDept: {
    type: String,
    required: [true, 'Class or Department is required'],
    trim: true
  },
  role: {
    type: String,
    enum: ['Student', 'Teacher'],
    required: [true, 'Role is required']
  },
  template: {
    type: String,
    enum: ['student-1', 'student-2', 'teacher-1', 'teacher-2'],
    default: 'student-1'
  },
  
  // Images
  schoolLogoUrl: {
    type: String,
    default: null
  },
  personPhotoUrl: {
    type: String,
    default: null
  },
  idCardImageUrl: {
    type: String,
    required: [true, 'ID card image URL is required']
  },
  
  // Metadata
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  academicYear: {
    type: String,
    default: new Date().getFullYear().toString()
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
idCardSchema.index({ schoolId: 1, personId: 1 });
idCardSchema.index({ schoolId: 1, role: 1 });
idCardSchema.index({ personId: 1, personModel: 1 });
idCardSchema.index({ idNumber: 1 });

const IDCard = mongoose.model('IDCard', idCardSchema);

module.exports = IDCard;

