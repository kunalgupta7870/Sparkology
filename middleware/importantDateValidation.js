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
    .isIn(['holiday', 'event', 'meeting', 'deadline', 'other'])
    .withMessage('Event type must be one of: holiday, event, meeting, deadline, other'),

  body('priority')
    .optional()
    .isIn(['normal', 'low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: normal, low, medium, high, critical'),

  body('classes')
    .optional()
    .isArray()
    .withMessage('Classes must be an array'),

  body('classes.*')
    .optional()
    .custom((value, { req }) => {
      // If applyToAllClasses is true, always allow (skip validation)
      if (req.body.applyToAllClasses === true || req.body.applyToAllClasses === 'true') {
        return true;
      }
      // Otherwise validate as MongoDB ObjectId if value exists
      if (value && !value.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Each class must be a valid MongoDB ObjectId');
      }
      return true;
    }),

  body('applyToAllClasses')
    .optional()
    .isBoolean()
    .withMessage('applyToAllClasses must be a boolean'),

  body('startTime')
    .optional({ checkFalsy: true })
    .custom((value) => {
      if (value && !value.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
        throw new Error('Start time must be in HH:MM format');
      }
      return true;
    }),

  body('endTime')
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (value && !value.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
        throw new Error('End time must be in HH:MM format');
      }
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

  body('endDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (value && req.body.date) {
        const startDate = new Date(req.body.date);
        const endDate = new Date(value);
        
        if (endDate < startDate) {
          throw new Error('End date must be after or equal to start date');
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
    .isIn(['holiday', 'event', 'meeting', 'deadline', 'other'])
    .withMessage('Event type must be one of: holiday, event, meeting, deadline, other'),

  body('priority')
    .optional()
    .isIn(['normal', 'low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: normal, low, medium, high, critical'),

  body('classes')
    .optional()
    .isArray()
    .withMessage('Classes must be an array'),

  body('classes.*')
    .optional()
    .custom((value, { req }) => {
      // If applyToAllClasses is true, always allow (skip validation)
      if (req.body.applyToAllClasses === true || req.body.applyToAllClasses === 'true') {
        return true;
      }
      // Otherwise validate as MongoDB ObjectId if value exists
      if (value && !value.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Each class must be a valid MongoDB ObjectId');
      }
      return true;
    }),

  body('applyToAllClasses')
    .optional()
    .isBoolean()
    .withMessage('applyToAllClasses must be a boolean'),

  body('startTime')
    .optional({ checkFalsy: true })
    .custom((value) => {
      if (value && !value.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
        throw new Error('Start time must be in HH:MM format');
      }
      return true;
    }),

  body('endTime')
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (value && !value.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
        throw new Error('End time must be in HH:MM format');
      }
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

  body('endDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (value && req.body.date) {
        const startDate = new Date(req.body.date);
        const endDate = new Date(value);
        
        if (endDate < startDate) {
          throw new Error('End date must be after or equal to start date');
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
