const { body } = require('express-validator');

// Class creation validation
const classValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Class name is required')
    .isLength({ max: 50 })
    .withMessage('Class name cannot exceed 50 characters'),

  body('section')
    .trim()
    .notEmpty()
    .withMessage('Section is required')
    .isLength({ max: 10 })
    .withMessage('Section cannot exceed 10 characters'),

  body('teacherId')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid teacher ID'),

  body('capacity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be between 1 and 100'),

  body('room')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Room name cannot exceed 50 characters'),

  body('academicYear')
    .optional()
    .isLength({ min: 4, max: 9 })
    .withMessage('Academic year must be valid (e.g., 2024-2025)'),

  body('subjects')
    .optional()
    .isArray()
    .withMessage('Subjects must be an array')
];

// Class update validation (less strict)
const classUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Class name cannot be empty')
    .isLength({ max: 50 })
    .withMessage('Class name cannot exceed 50 characters'),

  body('section')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Section cannot be empty')
    .isLength({ max: 10 })
    .withMessage('Section cannot exceed 10 characters'),

  body('teacherId')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid teacher ID'),

  body('capacity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be between 1 and 100'),

  body('room')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Room name cannot exceed 50 characters'),

  body('academicYear')
    .optional()
    .isLength({ min: 4, max: 9 })
    .withMessage('Academic year must be valid (e.g., 2024-2025)'),

  body('subjects')
    .optional()
    .isArray()
    .withMessage('Subjects must be an array'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'completed'])
    .withMessage('Status must be active, inactive, or completed')
];

module.exports = {
  classValidation,
  classUpdateValidation
};
