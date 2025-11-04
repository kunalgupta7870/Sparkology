const mongoose = require('mongoose');

const coCurricularPostSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student is required']
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  images: [{
    url: {
      type: String,
      trim: true
    },
    publicId: {
      type: String,
      trim: true
    }
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
coCurricularPostSchema.index({ student: 1 });
coCurricularPostSchema.index({ classId: 1 });
coCurricularPostSchema.index({ schoolId: 1 });
coCurricularPostSchema.index({ createdAt: -1 });

// Virtual for like count
coCurricularPostSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Instance method to toggle like
coCurricularPostSchema.methods.toggleLike = function(studentId) {
  const index = this.likes.indexOf(studentId);
  if (index > -1) {
    this.likes.splice(index, 1);
  } else {
    this.likes.push(studentId);
  }
  return this.save();
};

// Instance method to check if student liked the post
coCurricularPostSchema.methods.isLikedBy = function(studentId) {
  return this.likes.some(id => id.toString() === studentId.toString());
};

module.exports = mongoose.model('CoCurricularPost', coCurricularPostSchema);

