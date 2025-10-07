const express = require('express');
const { body } = require('express-validator');
const {
  getSchools,
  getSchool,
  createSchool,
  updateSchool,
  deleteSchool,
  createSchoolAdmin,
  getSchoolStats,
  getSchoolTeachers
} = require('../controllers/schoolController');
const { protect, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const schoolValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('School name must be between 2 and 200 characters'),
  body('code')
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('School code must be between 2 and 20 characters'),
  body('address')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Address must be between 10 and 500 characters'),
  body('contact')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Contact information must be between 5 and 100 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be active, inactive, or suspended'),
  body('plan')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Plan name cannot exceed 50 characters'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Please provide a valid website URL'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters')
];

const schoolAdminValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// Routes that require admin access
router.use(protect);
router.use(isAdmin);

router.get('/', getSchools);
router.get('/stats', getSchoolStats);
router.get('/:id', getSchool);
router.post('/', schoolValidation, createSchool);
router.put('/:id', schoolValidation, updateSchool);
router.delete('/:id', deleteSchool);
router.post('/:id/admin', schoolAdminValidation, createSchoolAdmin);

// Routes that allow school admin access
router.get('/:id/teachers', protect, getSchoolTeachers);

module.exports = router;
