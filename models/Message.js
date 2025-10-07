const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [2000, 'Message content cannot exceed 2000 characters']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel',
    required: true
  },
  senderModel: {
    type: String,
    enum: ['User', 'Student'],
    required: true
  },
  senderDisplayType: {
    type: String,
    enum: ['teacher', 'student', 'father', 'mother', 'guardian'],
    required: true
  },
  senderRole: {
    type: String,
    enum: ['teacher', 'student', 'parent'],
    required: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false,
    index: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientModel',
    required: false
  },
  recipientModel: {
    type: String,
    enum: ['User', 'Student'],
    required: false
  },
  recipientDisplayType: {
    type: String,
    enum: ['teacher', 'student', 'father', 'mother', 'guardian'],
    required: false
  },
  recipientRole: {
    type: String,
    enum: ['teacher', 'student', 'parent'],
    required: false
  },
  parentType: {
    type: String,
    enum: ['father', 'mother', 'guardian'],
    required: false
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'announcement'],
    default: 'text'
  },
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'reactions.userModel',
      required: true
    },
    userModel: {
      type: String,
      enum: ['User', 'Student'],
      required: true
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'readBy.userModel',
      required: true
    },
    userModel: {
      type: String,
      enum: ['User', 'Student'],
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  isAnnouncement: {
    type: Boolean,
    default: false
  },
  announcementType: {
    type: String,
    enum: ['general', 'important', 'urgent'],
    default: 'general'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Validation: Either groupId or recipient must be provided
messageSchema.pre('validate', function(next) {
  if (!this.groupId && !this.recipient) {
    return next(new Error('Either groupId or recipient must be provided'));
  }
  if (this.groupId && this.recipient) {
    return next(new Error('Cannot have both groupId and recipient'));
  }
  next();
});

// Indexes for better query performance
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ schoolId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, senderModel: 1 });
messageSchema.index({ recipient: 1, recipientModel: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ isDeleted: 1 });

// Virtual for sender name
messageSchema.virtual('senderName').get(function() {
  if (this.senderModel === 'User') {
    return this.sender?.name || 'Unknown User';
  } else if (this.senderModel === 'Student') {
    return this.sender?.name || 'Unknown Student';
  }
  return 'Unknown';
});

// Virtual for sender role removed - now using actual senderRole field

// Virtual for read count
messageSchema.virtual('readCount').get(function() {
  return this.readBy.length;
});

// Virtual for reaction count
messageSchema.virtual('reactionCount').get(function() {
  return this.reactions.length;
});

// Static method to get messages for a group
messageSchema.statics.getGroupMessages = function(groupId, page = 1, limit = 50) {
  return this.find({
    groupId,
    isDeleted: false
  })
    .populate('sender', 'name email role')
    .populate('replyTo', 'content sender')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Static method to get unread message count for a user
messageSchema.statics.getUnreadCount = function(groupId, userId, userModel) {
  return this.countDocuments({
    groupId,
    isDeleted: false,
    'readBy.user': { $ne: userId },
    'readBy.userModel': { $ne: userModel }
  });
};

// Static method to mark messages as read
messageSchema.statics.markAsRead = function(groupId, userId, userModel) {
  return this.updateMany(
    {
      groupId,
      isDeleted: false,
      'readBy.user': { $ne: userId },
      'readBy.userModel': { $ne: userModel }
    },
    {
      $push: {
        readBy: {
          user: userId,
          userModel: userModel,
          readAt: new Date()
        }
      }
    }
  );
};

// Instance method to add reaction
messageSchema.methods.addReaction = function(userId, userModel, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    reaction => !(reaction.user.toString() === userId.toString() && reaction.userModel === userModel)
  );
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    userModel: userModel,
    emoji: emoji,
    createdAt: new Date()
  });
  
  return this.save();
};

// Instance method to remove reaction
messageSchema.methods.removeReaction = function(userId, userModel) {
  this.reactions = this.reactions.filter(
    reaction => !(reaction.user.toString() === userId.toString() && reaction.userModel === userModel)
  );
  
  return this.save();
};

// Instance method to edit message
messageSchema.methods.editMessage = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

// Instance method to delete message (soft delete)
messageSchema.methods.deleteMessage = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = 'This message was deleted';
  
  return this.save();
};

// Pre-save middleware to populate sender info
messageSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      if (this.senderModel === 'User') {
        await this.populate('sender', 'name email role');
      } else if (this.senderModel === 'Student') {
        await this.populate('sender', 'name rollNumber');
      }
    } catch (error) {
      console.error('Error populating sender:', error);
    }
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
