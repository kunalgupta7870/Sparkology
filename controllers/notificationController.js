const Notification = require('../models/Notification');
const Student = require('../models/Student');
const DeviceToken = require('../models/DeviceToken');
const { validationResult } = require('express-validator');

// @desc    Get student notifications
// @route   GET /api/notifications
// @access  Private (Student)
const getStudentNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isRead } = req.query;
    const studentId = req.user._id;
    
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.getStudentNotifications(studentId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      type,
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined
    });

    const totalNotifications = await Notification.countDocuments({
      recipient: studentId,
      ...(type && { type }),
      ...(isRead !== undefined && { isRead: isRead === 'true' })
    });

    const unreadCount = await Notification.getUnreadCount(studentId);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalNotifications / limit),
          totalNotifications,
          hasNextPage: skip + notifications.length < totalNotifications,
          hasPrevPage: page > 1
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get student notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching notifications'
    });
  }
};

// @desc    Get notification count
// @route   GET /api/notifications/count
// @access  Private (Student)
const getNotificationCount = async (req, res) => {
  try {
    const studentId = req.user._id;
    const unreadCount = await Notification.getUnreadCount(studentId);
    
    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get notification count error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching notification count'
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private (Student)
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user._id;
    
    const notification = await Notification.findOne({
      _id: id,
      recipient: studentId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    await notification.markAsRead();
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking notification as read'
    });
  }
};

// @desc    Mark multiple notifications as read
// @route   PUT /api/notifications/mark-read
// @access  Private (Student)
const markNotificationsAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const studentId = req.user._id;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification IDs'
      });
    }
    
    const result = await Notification.markAsRead(notificationIds, studentId);
    
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark notifications as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking notifications as read'
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private (Student)
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const studentId = req.user._id;
    
    const result = await Notification.updateMany(
      { recipient: studentId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking all notifications as read'
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private (Student)
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user._id;
    
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: studentId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting notification'
    });
  }
};

// @desc    Create notification (for teachers/admin)
// @route   POST /api/notifications
// @access  Private (Teacher, School Admin)
const createNotification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      title,
      message,
      type,
      recipients, // Array of student IDs
      priority = 'medium',
      relatedId,
      relatedType,
      actionUrl
    } = req.body;

    const schoolId = req.user.schoolId;
    const senderId = req.user._id;

    // Validate recipients
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients are required'
      });
    }

    // Verify recipients belong to the school
    const validStudents = await Student.find({
      _id: { $in: recipients },
      schoolId,
      status: 'active'
    });

    if (validStudents.length !== recipients.length) {
      return res.status(400).json({
        success: false,
        error: 'Some recipients are invalid or inactive'
      });
    }

    // Create notifications for each recipient
    const notifications = validStudents.map(student => ({
      title,
      message,
      type,
      recipient: student._id,
      sender: senderId,
      schoolId,
      priority,
      relatedId,
      relatedType,
      actionUrl
    }));

    const createdNotifications = await Notification.insertMany(notifications);

    // Send push notifications to recipients
    try {
      const { sendPushNotificationsToUsers } = require('../utils/pushNotifications');
      const recipientIds = validStudents.map(s => s._id.toString());
      await sendPushNotificationsToUsers(
        recipientIds,
        'Student',
        title,
        message,
        {
          type,
          relatedId: relatedId ? relatedId.toString() : null,
          relatedType,
          actionUrl
        }
      );
      console.log(`📱 Sent push notifications to ${recipientIds.length} students`);
    } catch (pushError) {
      console.error('Error sending push notifications:', pushError);
      // Don't fail if push notifications fail
    }

    res.status(201).json({
      success: true,
      message: 'Notifications created successfully',
      data: {
        notifications: createdNotifications,
        count: createdNotifications.length
      }
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating notifications'
    });
  }
};

// @desc    Register push token
// @route   POST /api/notifications/register-push-token
// @access  Private
const registerPushToken = async (req, res) => {
  try {
    const { expoPushToken, platform = 'android', deviceId = null } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        error: 'Expo push token is required'
      });
    }

    // Determine user model based on role
    const userModel = userRole === 'student' ? 'Student' : 'User';

    // Register or update the token
    const token = await DeviceToken.registerToken(
      userId,
      userModel,
      expoPushToken,
      platform,
      deviceId
    );

    res.status(200).json({
      success: true,
      message: 'Push token registered successfully',
      data: {
        token: token._id
      }
    });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while registering push token'
    });
  }
};

module.exports = {
  getStudentNotifications,
  getNotificationCount,
  markNotificationAsRead,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  createNotification,
  registerPushToken
};
