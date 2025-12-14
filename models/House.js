const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'House name is required'],
    trim: true,
    maxlength: [100, 'House name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  color: {
    type: String,
    trim: true,
    default: '#3B82F6' // Default blue color (can be red, blue, green, yellow, or custom)
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required'],
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  houseCaptain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: null
  },
  viceCaptain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  points: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
houseSchema.index({ schoolId: 1, isActive: 1 });
houseSchema.index({ schoolId: 1, name: 1 }, { unique: true });

// Virtual for student count
houseSchema.virtual('studentCount', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'houseId',
  count: true
});

// Static method to get houses by school
houseSchema.statics.getHousesBySchool = function(schoolId, isActive = true) {
  return this.find({
    schoolId,
    ...(isActive !== null && { isActive })
  }).populate('houseCaptain', 'name email rollNumber')
    .populate('viceCaptain', 'name email rollNumber')
    .sort({ name: 1 });
};

// Instance method to get all students in this house
houseSchema.methods.getStudents = async function() {
  const Student = require('./Student');
  return await Student.find({
    houseId: this._id,
    status: 'active'
  }).populate('classId', 'name section')
    .sort({ name: 1 });
};

// Instance method to update points
houseSchema.methods.addPoints = function(points) {
  this.points += points;
  return this.save();
};

// Instance method to remove points
houseSchema.methods.removePoints = function(points) {
  this.points = Math.max(0, this.points - points);
  return this.save();
};

module.exports = mongoose.model('House', houseSchema);

