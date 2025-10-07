const { body } = require('express-validator');

// Validation rules for creating/updating important dates
const validateImportantDate = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date')
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Allow dates from 1 year ago to 2 years in the future
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      
      const twoYearsFuture = new Date(today);
      twoYearsFuture.setFullYear(today.getFullYear() + 2);
      
      if (date < oneYearAgo || date > twoYearsFuture) {
        throw new Error('Date must be within 1 year ago to 2 years in the future');
      }
      
      return true;
    }),

  body('type')
    .notEmpty()
    .withMessage('Event type is required')
    .isIn(['holiday', 'exam', 'event', 'meeting', 'deadline', 'other'])
    .withMessage('Event type must be one of: holiday, exam, event, meeting, deadline, other'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: low, medium, high, critical'),

  body('classes')
    .optional()
    .isArray()
    .withMessage('Classes must be an array'),

  body('classes.*')
    .optional()
    .custom((value, { req }) => {
      // If applyToAllClasses is true, skip validation for empty array
      if (req.body.applyToAllClasses === true && (!req.body.classes || req.body.classes.length === 0)) {
        return true;
      }
      // Otherwise validate as MongoDB ObjectId
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Each class must be a valid MongoDB ObjectId');
      }
      return true;
    }),

  body('applyToAllClasses')
    .optional()
    .isBoolean()
    .withMessage('applyToAllClasses must be a boolean'),

  body('startTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),

  body('endTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format')
    .custom((value, { req }) => {
      if (value && req.body.startTime) {
        const startTime = req.body.startTime.split(':');
        const endTime = value.split(':');
        
        const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1]);
        const endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1]);
        
        if (endMinutes <= startMinutes) {
          throw new Error('End time must be after start time');
        }
      }
      return true;
    }),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),

  body('academicYear')
    .optional()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in YYYY-YYYY format')
];

// Validation rules for updating important dates (all fields optional)
const validateImportantDateUpdate = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty if provided')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date')
    .custom((value) => {
      if (value) {
        const date = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Allow dates from 1 year ago to 2 years in the future
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        
        const twoYearsFuture = new Date(today);
        twoYearsFuture.setFullYear(today.getFullYear() + 2);
        
        if (date < oneYearAgo || date > twoYearsFuture) {
          throw new Error('Date must be within 1 year ago to 2 years in the future');
        }
      }
      return true;
    }),

  body('type')
    .optional()
    .isIn(['holiday', 'exam', 'event', 'meeting', 'deadline', 'other'])
    .withMessage('Event type must be one of: holiday, exam, event, meeting, deadline, other'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: low, medium, high, critical'),

  body('classes')
    .optional()
    .isArray()
    .withMessage('Classes must be an array'),

  body('classes.*')
    .optional()
    .custom((value, { req }) => {
      // If applyToAllClasses is true, skip validation for empty array
      if (req.body.applyToAllClasses === true && (!req.body.classes || req.body.classes.length === 0)) {
        return true;
      }
      // Otherwise validate as MongoDB ObjectId
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Each class must be a valid MongoDB ObjectId');
      }
      return true;
    }),

  body('applyToAllClasses')
    .optional()
    .isBoolean()
    .withMessage('applyToAllClasses must be a boolean'),

  body('startTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),

  body('endTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format')
    .custom((value, { req }) => {
      if (value && req.body.startTime) {
        const startTime = req.body.startTime.split(':');
        const endTime = value.split(':');
        
        const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1]);
        const endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1]);
        
        if (endMinutes <= startMinutes) {
          throw new Error('End time must be after start time');
        }
      }
      return true;
    }),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),

  body('academicYear')
    .optional()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in YYYY-YYYY format')
];

module.exports = {
  validateImportantDate,
  validateImportantDateUpdate
};
