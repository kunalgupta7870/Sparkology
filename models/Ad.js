const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Ad title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true
  },
  thumbnailUrl: {
    type: String,
    trim: true
  },
  linkUrl: {
    type: String,
    trim: true,
    maxlength: [500, 'Link URL cannot exceed 500 characters']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  category: {
    type: String,
    default: 'general',
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader is required']
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: false // Optional - admin users don't have schoolId
  },
  // Cloudinary metadata
  cloudinaryId: {
    type: String,
    trim: true
  },
  originalFilename: {
    type: String,
    trim: true
  },
  fileSize: {
    type: Number, // in bytes
    default: 0
  },
  mimeType: {
    type: String,
    trim: true
  },
  width: {
    type: Number,
    default: 0
  },
  height: {
    type: Number,
    default: 0
  },
  // Ad metadata
  isPublic: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  clickCount: {
    type: Number,
    default: 0
  },
  // Ad scheduling
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  // Additional metadata
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  position: {
    type: String,
    enum: ['banner', 'sidebar', 'popup', 'inline'],
    default: 'banner'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
adSchema.index({ title: 'text', description: 'text', tags: 'text' });
adSchema.index({ schoolId: 1 });
adSchema.index({ uploadedBy: 1 });
adSchema.index({ category: 1 });
adSchema.index({ tags: 1 });
adSchema.index({ isActive: 1, isPublic: 1 });
adSchema.index({ createdAt: -1 });
adSchema.index({ priority: -1 });
adSchema.index({ startDate: 1, endDate: 1 });

// Virtual for formatted file size
adSchema.virtual('formattedFileSize').get(function() {
  if (this.fileSize === 0) return 'Unknown';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual for aspect ratio
adSchema.virtual('aspectRatio').get(function() {
  if (this.width && this.height) {
    return (this.width / this.height).toFixed(2);
  }
  return null;
});

// Virtual for formatted dimensions
adSchema.virtual('formattedDimensions').get(function() {
  if (this.width && this.height) {
    return `${this.width} × ${this.height}`;
  }
  return 'Unknown';
});

// Virtual to check if ad is currently active based on dates
adSchema.virtual('isCurrentlyActive').get(function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  
  return true;
});

// Pre-save middleware to generate thumbnail URL if not provided
adSchema.pre('save', function(next) {
  if (this.imageUrl && !this.thumbnailUrl) {
    // Generate thumbnail URL from Cloudinary URL with proper transformation syntax
    this.thumbnailUrl = this.imageUrl.replace('/upload/', '/upload/w_300,h_200,c_fill/');
  }
  next();
});

// Static method to get ads by school
adSchema.statics.getAdsBySchool = function(schoolId, filters = {}) {
  const query = { schoolId, isActive: true, ...filters };
  return this.find(query).populate('uploadedBy', 'name email');
};

// Static method to get ads by category
adSchema.statics.getAdsByCategory = function(category, filters = {}) {
  const query = { category, isActive: true, isPublic: true, ...filters };
  return this.find(query).populate('uploadedBy', 'name email');
};

// Static method to search ads
adSchema.statics.searchAds = function(query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    isActive: true,
    isPublic: true,
    ...filters
  };
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .populate('uploadedBy', 'name email');
};

// Static method to get active ads (based on dates and status)
adSchema.statics.getActiveAds = function(filters = {}) {
  const now = new Date();
  const query = {
    isActive: true,
    isPublic: true,
    startDate: { $lte: now },
    $or: [
      { endDate: { $gte: now } },
      { endDate: null }
    ],
    ...filters
  };
  
  return this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .populate('uploadedBy', 'name email');
};

// Instance method to increment view count
adSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Instance method to increment click count
adSchema.methods.incrementClickCount = function() {
  this.clickCount += 1;
  return this.save();
};

// Instance method to add tags
adSchema.methods.addTags = function(newTags) {
  const tagsToAdd = newTags.filter(tag => !this.tags.includes(tag.toLowerCase()));
  this.tags.push(...tagsToAdd);
  return this.save();
};

// Instance method to remove tags
adSchema.methods.removeTags = function(tagsToRemove) {
  this.tags = this.tags.filter(tag => !tagsToRemove.includes(tag));
  return this.save();
};

module.exports = mongoose.model('Ad', adSchema);

