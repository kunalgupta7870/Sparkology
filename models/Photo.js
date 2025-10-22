const mongoose = require('mongoose');

const factOfTheDaySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Fact title is required'],
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
  // Photo metadata
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
  downloadCount: {
    type: Number,
    default: 0
  },
  // Additional metadata
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  takenAt: {
    type: Date
  },
  camera: {
    type: String,
    trim: true
  },
  settings: {
    aperture: String,
    shutterSpeed: String,
    iso: String,
    focalLength: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
factOfTheDaySchema.index({ title: 'text', description: 'text', tags: 'text' });
factOfTheDaySchema.index({ schoolId: 1 });
factOfTheDaySchema.index({ uploadedBy: 1 });
factOfTheDaySchema.index({ category: 1 });
factOfTheDaySchema.index({ tags: 1 });
factOfTheDaySchema.index({ isActive: 1, isPublic: 1 });
factOfTheDaySchema.index({ createdAt: -1 });

// Virtual for formatted file size
factOfTheDaySchema.virtual('formattedFileSize').get(function() {
  if (this.fileSize === 0) return 'Unknown';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual for aspect ratio
factOfTheDaySchema.virtual('aspectRatio').get(function() {
  if (this.width && this.height) {
    return (this.width / this.height).toFixed(2);
  }
  return null;
});

// Virtual for formatted dimensions
factOfTheDaySchema.virtual('formattedDimensions').get(function() {
  if (this.width && this.height) {
    return `${this.width} × ${this.height}`;
  }
  return 'Unknown';
});

// Pre-save middleware to generate thumbnail URL if not provided
factOfTheDaySchema.pre('save', function(next) {
  if (this.imageUrl && !this.thumbnailUrl) {
    // Generate thumbnail URL from Cloudinary URL with proper transformation syntax
    this.thumbnailUrl = this.imageUrl.replace('/upload/', '/upload/w_300,h_200,c_fill/');
  }
  next();
});

// Static method to get facts by school
factOfTheDaySchema.statics.getFactsBySchool = function(schoolId, filters = {}) {
  const query = { schoolId, isActive: true, ...filters };
  return this.find(query).populate('uploadedBy', 'name email');
};

// Static method to get facts by category
factOfTheDaySchema.statics.getFactsByCategory = function(category, filters = {}) {
  const query = { category, isActive: true, isPublic: true, ...filters };
  return this.find(query).populate('uploadedBy', 'name email');
};

// Static method to search facts
factOfTheDaySchema.statics.searchFacts = function(query, filters = {}) {
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

// Static method to get facts by tags
factOfTheDaySchema.statics.getFactsByTags = function(tags, filters = {}) {
  const query = {
    tags: { $in: tags },
    isActive: true,
    isPublic: true,
    ...filters
  };
  
  return this.find(query).populate('uploadedBy', 'name email');
};

// Static method to get popular facts
factOfTheDaySchema.statics.getPopularFacts = function(limit = 10, filters = {}) {
  const query = { isActive: true, isPublic: true, ...filters };
  return this.find(query)
    .sort({ viewCount: -1 })
    .limit(limit)
    .populate('uploadedBy', 'name email');
};

// Instance method to increment view count
factOfTheDaySchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Instance method to increment download count
factOfTheDaySchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  return this.save();
};

// Instance method to add tags
factOfTheDaySchema.methods.addTags = function(newTags) {
  const tagsToAdd = newTags.filter(tag => !this.tags.includes(tag.toLowerCase()));
  this.tags.push(...tagsToAdd);
  return this.save();
};

// Instance method to remove tags
factOfTheDaySchema.methods.removeTags = function(tagsToRemove) {
  this.tags = this.tags.filter(tag => !tagsToRemove.includes(tag));
  return this.save();
};

module.exports = mongoose.model('FactOfTheDay', factOfTheDaySchema);
