const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Title is required'], 
    trim: true, 
    maxlength: 300 
  },
  content: { 
    type: String, 
    required: [true, 'Content is required'],
    trim: true, 
    maxlength: 5000 
  },
  publishDate: { 
    type: Date,
    required: [true, 'Publish date is required'],
    default: Date.now
  },
  expiryDate: { 
    type: Date 
  },
  type: { 
    type: String, 
    enum: ['general', 'exam', 'holiday', 'event', 'circular', 'notice', 'achievement', 'other'], 
    default: 'general' 
  },
  category: {
    type: String,
    enum: ['academic', 'administrative', 'sports', 'cultural', 'other'],
    required: true
  },
  priority: { 
    type: String, 
    enum: ['low', 'normal', 'medium', 'high', 'urgent'], 
    default: 'normal' 
  },
  audience: {
    students: { type: Boolean, default: true },
    teachers: { type: Boolean, default: true },
    parents: { type: Boolean, default: true },
    staff: { type: Boolean, default: false }
  },
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true 
  },
  classes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  }],
  subjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  applyToAllClasses: { 
    type: Boolean, 
    default: true 
  },
  attachments: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['image', 'pdf', 'doc', 'other']
    },
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  acknowledgement: {
    required: { type: Boolean, default: false },
    acknowledgedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now }
    }]
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  lastUpdatedBy: { 
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
announcementSchema.index({ schoolId: 1, publishDate: 1, status: 1, isActive: 1 });
announcementSchema.index({ schoolId: 1, type: 1, category: 1 });
announcementSchema.index({ 'acknowledgement.acknowledgedBy.user': 1 });

// Virtual for acknowledgement status
announcementSchema.virtual('acknowledgementStats').get(function() {
  const totalAcknowledged = this.acknowledgement.acknowledgedBy.length;
  return {
    totalAcknowledged,
    isPending: this.acknowledgement.required && totalAcknowledged === 0,
    lastAcknowledged: totalAcknowledged > 0 ? 
      this.acknowledgement.acknowledgedBy[totalAcknowledged - 1].timestamp : null
  };
});

announcementSchema.set('toJSON', { virtuals: true });
announcementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Announcement', announcementSchema);
