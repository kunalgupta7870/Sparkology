const mongoose = require('mongoose');

const feeCategorySchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
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
feeCategorySchema.index({ school: 1 });
feeCategorySchema.index({ status: 1 });
feeCategorySchema.index({ name: 1, school: 1 }, { unique: true });

// Static method to get categories by school
feeCategorySchema.statics.getCategoriesBySchool = function(schoolId) {
  return this.find({ school: schoolId })
    .populate('createdBy', 'name email')
    .sort({ name: 1 });
};

// Static method to get active categories
feeCategorySchema.statics.getActiveCategories = function(schoolId) {
  return this.find({ school: schoolId, status: 'active' })
    .sort({ name: 1 });
};

module.exports = mongoose.model('FeeCategory', feeCategorySchema);

