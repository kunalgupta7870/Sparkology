const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 300 },
  content: { type: String, trim: true, maxlength: 2000 },
  date: { type: Date },
  type: { type: String, enum: ['general', 'exam', 'holiday', 'other'], default: 'general' },
  priority: { type: String, enum: ['low','normal','medium','high'], default: 'normal' },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  applyToAllClasses: { type: Boolean, default: true },
  attachments: [{ name: String, url: String, uploadedAt: { type: Date, default: Date.now } }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

announcementSchema.index({ schoolId: 1, date: 1, isActive: 1 });

announcementSchema.set('toJSON', { virtuals: true });
announcementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Announcement', announcementSchema);
