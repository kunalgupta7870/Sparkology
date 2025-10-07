const express = require('express');
const { body } = require('express-validator');
const {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  addMembers,
  removeMembers,
  deleteGroup,
  getAvailableStudents,
  getStudentGroups,
  createOrFindIndividualChat,
  getIndividualChats
} = require('../controllers/groupController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Validation rules
const createGroupValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('type')
    .optional()
    .isIn(['class', 'subject', 'custom'])
    .withMessage('Invalid group type'),
  body('classId')
    .optional()
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('studentIds')
    .optional()
    .isArray()
    .withMessage('Student IDs must be an array'),
  body('studentIds.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid student ID')
];

const updateGroupValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
];

const addMembersValidation = [
  body('userIds')
    .optional()
    .isArray()
    .withMessage('User IDs must be an array'),
  body('userIds.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('studentIds')
    .optional()
    .isArray()
    .withMessage('Student IDs must be an array'),
  body('studentIds.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid student ID')
];

const removeMembersValidation = [
  body('userIds')
    .optional()
    .isArray()
    .withMessage('User IDs must be an array'),
  body('userIds.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('studentIds')
    .optional()
    .isArray()
    .withMessage('Student IDs must be an array'),
  body('studentIds.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid student ID')
];

// Routes
// @route   GET /api/groups
// @desc    Get all groups for a school
// @access  Private (Teacher, School Admin)
router.get('/', getGroups);

// @route   GET /api/groups/available-students
// @desc    Get available students for group creation
// @access  Private (Teacher)
router.get('/available-students', authorize(['teacher', 'school_admin']), getAvailableStudents);

// @route   GET /api/groups/student
// @desc    Get student's groups
// @access  Private (Student)
router.get('/student', authorize(['student']), getStudentGroups);

// @route   GET /api/groups/individual-chats
// @desc    Get individual chat groups for a user
// @access  Private (Student, Teacher)
router.get('/individual-chats', authorize(['student', 'teacher']), getIndividualChats);

// @route   GET /api/groups/:id
// @desc    Get group by ID
// @access  Private (Group Members)
router.get('/:id', getGroup);

// @route   POST /api/groups
// @desc    Create new group
// @access  Private (Teacher)
router.post('/', authorize(['teacher', 'school_admin']), createGroupValidation, createGroup);

// @route   POST /api/groups/individual-chat
// @desc    Create or find individual chat group
// @access  Private (Student, Teacher)
router.post('/individual-chat', authorize(['student', 'teacher']), createOrFindIndividualChat);

// @route   PUT /api/groups/:id
// @desc    Update group
// @access  Private (Group Admin)
router.put('/:id', updateGroupValidation, updateGroup);

// @route   POST /api/groups/:id/members
// @desc    Add members to group
// @access  Private (Group Admin)
router.post('/:id/members', addMembersValidation, addMembers);

// @route   DELETE /api/groups/:id/members
// @desc    Remove members from group
// @access  Private (Group Admin)
router.delete('/:id/members', removeMembersValidation, removeMembers);

// @route   DELETE /api/groups/:id
// @desc    Delete group
// @access  Private (Group Creator, School Admin)
router.delete('/:id', deleteGroup);

module.exports = router;
