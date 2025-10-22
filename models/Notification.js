const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['assignment', 'assignment_submission', 'grade', 'course', 'group', 'achievement', 'general'],
    required: [true, 'Notification type is required']
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientModel',
    required: [true, 'Recipient is required']
  },
  recipientModel: {
    type: String,
    enum: ['Student', 'User'],
    default: 'Student'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Teacher who created the notification
    required: false
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // Can reference assignment, grade, etc.
  },
  relatedType: {
    type: String,
    enum: ['assignment', 'grade', 'course', 'group', 'achievement'],
    required: false
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  icon: {
    type: String,
    default: 'notifications'
  },
  color: {
    type: String,
    default: '#2196F3'
  },
  actionUrl: {
    type: String,
    required: false // URL or route to navigate when notification is clicked
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ schoolId: 1, type: 1 });
notificationSchema.index({ relatedId: 1, relatedType: 1 });

// Static method to create assignment notification
notificationSchema.statics.createAssignmentNotification = async function(assignment, students) {
  const notifications = [];
  
  for (const student of students) {
    const notification = new this({
      title: 'New Assignment',
      message: `${assignment.title} - Due ${new Date(assignment.dueDate).toLocaleDateString()}`,
      type: 'assignment',
      recipient: student._id,
      sender: assignment.teacherId,
      schoolId: assignment.schoolId,
      relatedId: assignment._id,
      relatedType: 'assignment',
      priority: 'high',
      icon: 'document-text',
      color: '#8B5CF6',
      actionUrl: `/assignments/${assignment._id}`,
      metadata: {
        assignmentTitle: assignment.title,
        subjectName: assignment.subjectId?.name || 'Unknown Subject',
        dueDate: assignment.dueDate,
        totalMarks: assignment.totalMarks
      }
    });
    
    notifications.push(notification);
  }
  
  return this.insertMany(notifications);
};

// Static method to get notifications for a student
notificationSchema.statics.getStudentNotifications = function(studentId, options = {}) {
  const { limit = 20, skip = 0, type, isRead } = options;
  
  const query = { recipient: studentId };
  
  if (type) query.type = type;
  if (isRead !== undefined) query.isRead = isRead;
  
  return this.find(query)
    .populate('sender', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = function(notificationIds, studentId) {
  return this.updateMany(
    { 
      _id: { $in: notificationIds },
      recipient: studentId,
      isRead: false 
    },
    { 
      isRead: true,
      readAt: new Date()
    }
  );
};

// Static method to get unread count for a student
notificationSchema.statics.getUnreadCount = function(studentId) {
  return this.countDocuments({
    recipient: studentId,
    isRead: false
  });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
