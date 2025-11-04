const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Student', 'User'] // Student or Teacher/Admin (User model)
  },
  expoPushToken: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    default: 'android'
  },
  deviceId: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient lookups
deviceTokenSchema.index({ userId: 1, userModel: 1 });
deviceTokenSchema.index({ expoPushToken: 1 });
deviceTokenSchema.index({ isActive: 1 });

// Static method to register or update device token
deviceTokenSchema.statics.registerToken = async function(userId, userModel, expoPushToken, platform, deviceId = null) {
  // Remove old token if exists for this device
  if (deviceId) {
    await this.updateMany(
      { userId, userModel, deviceId },
      { isActive: false }
    );
  }
  
  // Find existing token or create new one
  const token = await this.findOne({ expoPushToken });
  
  if (token) {
    // Update existing token
    token.userId = userId;
    token.userModel = userModel;
    token.platform = platform;
    token.deviceId = deviceId;
    token.isActive = true;
    return await token.save();
  } else {
    // Create new token
    return await this.create({
      userId,
      userModel,
      expoPushToken,
      platform,
      deviceId,
      isActive: true
    });
  }
};

// Static method to get tokens for a user
deviceTokenSchema.statics.getUserTokens = function(userId, userModel) {
  return this.find({ userId, userModel, isActive: true });
};

// Static method to remove token
deviceTokenSchema.statics.removeToken = function(expoPushToken) {
  return this.updateOne({ expoPushToken }, { isActive: false });
};

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);

