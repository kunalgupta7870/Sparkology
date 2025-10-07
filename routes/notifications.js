const express = require('express');
const {
  getStudentNotifications,
  getNotificationCount,
  markNotificationAsRead,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  createNotification
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Student routes
router.get('/', protect, authorize(['student']), getStudentNotifications);
router.get('/count', protect, authorize(['student']), getNotificationCount);
router.put('/:id/read', protect, authorize(['student']), markNotificationAsRead);
router.put('/mark-read', protect, authorize(['student']), markNotificationsAsRead);
router.put('/mark-all-read', protect, authorize(['student']), markAllNotificationsAsRead);
router.delete('/:id', protect, authorize(['student']), deleteNotification);

// Teacher/Admin routes
router.post('/', protect, authorize(['teacher', 'school_admin']), createNotification);

module.exports = router;
