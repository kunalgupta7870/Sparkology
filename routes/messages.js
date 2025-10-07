const express = require('express');
const { body } = require('express-validator');
const {
  sendDirectMessage,
  getDirectMessages,
  sendMessage,
  getGroupMessages,
  markMessagesAsRead,
  markDirectMessagesAsRead,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  getUnreadCounts
} = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Validation rules
const sendMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters'),
  body('groupId')
    .isMongoId()
    .withMessage('Invalid group ID'),
  body('messageType')
    .optional()
    .isIn(['text', 'image', 'file', 'announcement'])
    .withMessage('Invalid message type'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid reply message ID'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array')
];

const editMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters')
];

const addReactionValidation = [
  body('emoji')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Emoji must be between 1 and 10 characters')
];

const sendDirectMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters'),
  body('recipientId')
    .isMongoId()
    .withMessage('Invalid recipient ID'),
  body('recipientType')
    .isIn(['student', 'teacher', 'parent'])
    .withMessage('Invalid recipient type'),
  body('messageType')
    .optional()
    .isIn(['text', 'image', 'file'])
    .withMessage('Invalid message type'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid reply message ID'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array')
];

// Routes
// @route   GET /api/messages/unread-counts
// @desc    Get unread message counts for all groups
// @access  Private (Teacher, Student only - Parents cannot access chat)
router.get('/unread-counts', authorize(['teacher', 'student', 'school_admin']), getUnreadCounts);

// @route   POST /api/messages/direct
// @desc    Send direct message between two users
// @access  Private (Student, Teacher only - Parents cannot send messages)
router.post('/direct', sendDirectMessageValidation, authorize(['teacher', 'student']), sendDirectMessage);

// @route   GET /api/messages/direct/:recipientId
// @desc    Get direct messages between two users
// @access  Private (Student, Teacher only - Parents cannot access messages)
router.get('/direct/:recipientId', authorize(['teacher', 'student']), getDirectMessages);

// @route   PUT /api/messages/direct/:contactId/read
// @desc    Mark direct messages from a contact as read
// @access  Private (Student, Teacher only - Parents cannot access messages)
router.put('/direct/:contactId/read', authorize(['teacher', 'student']), markDirectMessagesAsRead);

// @route   GET /api/messages/group/:groupId
// @desc    Get messages for a group
// @access  Private (Group Members)
router.get('/group/:groupId', getGroupMessages);

// @route   POST /api/messages
// @desc    Send message to group
// @access  Private (Group Members)
router.post('/', sendMessageValidation, sendMessage);

// @route   PUT /api/messages/group/:groupId/read
// @desc    Mark messages as read
// @access  Private (Group Members)
router.put('/group/:groupId/read', markMessagesAsRead);

// @route   PUT /api/messages/:id
// @desc    Edit message
// @access  Private (Message Sender, Group Admin)
router.put('/:id', editMessageValidation, editMessage);

// @route   DELETE /api/messages/:id
// @desc    Delete message
// @access  Private (Message Sender, Group Admin, School Admin)
router.delete('/:id', deleteMessage);

// @route   POST /api/messages/:id/reaction
// @desc    Add reaction to message
// @access  Private (Group Members)
router.post('/:id/reaction', addReactionValidation, addReaction);

// @route   DELETE /api/messages/:id/reaction
// @desc    Remove reaction from message
// @access  Private (Group Members)
router.delete('/:id/reaction', removeReaction);

module.exports = router;
