const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male','female','other'] },
  classApplied: { type: String },
  parentName: { type: String },
  contact: { type: String },
  email: { type: String, lowercase: true, trim: true },
  address: { type: Object, default: {} },
  previousSchool: { type: String },
  attachments: [{ name: String, url: String }],
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

admissionSchema.index({ schoolId: 1, status: 1, isActive: 1 });

module.exports = mongoose.model('AdmissionApplication', admissionSchema);
