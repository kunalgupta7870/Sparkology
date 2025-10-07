const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true,
    maxlength: [50, 'Class name cannot exceed 50 characters']
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true,
    maxlength: [10, 'Section cannot exceed 10 characters']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1'],
    max: [100, 'Capacity cannot exceed 100']
  },
  room: {
    type: String,
    trim: true,
    maxlength: [50, 'Room name cannot exceed 50 characters']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    default: new Date().getFullYear().toString()
  },
  subjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    default: []
  }],
  schedule: {
    monday: [{
      subject: String,
      teacher: String,
      startTime: String,
      endTime: String,
      room: String
    }],
    tuesday: [{
      subject: String,
      teacher: String,
      startTime: String,
      endTime: String,
      room: String
    }],
    wednesday: [{
      subject: String,
      teacher: String,
      startTime: String,
      endTime: String,
      room: String
    }],
    thursday: [{
      subject: String,
      teacher: String,
      startTime: String,
      endTime: String,
      room: String
    }],
    friday: [{
      subject: String,
      teacher: String,
      startTime: String,
      endTime: String,
      room: String
    }],
    saturday: [{
      subject: String,
      teacher: String,
      startTime: String,
      endTime: String,
      room: String
    }]
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
classSchema.index({ schoolId: 1 });
classSchema.index({ teacherId: 1 });
classSchema.index({ name: 1, section: 1, schoolId: 1 }, { unique: true });
classSchema.index({ academicYear: 1 });

// Virtual for class display name
classSchema.virtual('displayName').get(function() {
  return `${this.name} - ${this.section}`;
});

// Virtual for student count
classSchema.virtual('studentCount', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'classId',
  count: true
});

// Static method to get classes by school
classSchema.statics.getClassesBySchool = function(schoolId) {
  return this.find({ schoolId }).populate('teacherId', 'name email').populate('subjects', 'name');
};

// Static method to get classes by teacher
classSchema.statics.getClassesByTeacher = function(teacherId) {
  return this.find({ teacherId }).populate('subjects', 'name');
};

// Static method to get active classes
classSchema.statics.getActiveClasses = function(schoolId = null) {
  const query = { status: 'active' };
  if (schoolId) {
    query.schoolId = schoolId;
  }
  return this.find(query).populate('teacherId', 'name email');
};

module.exports = mongoose.model('Class', classSchema);
