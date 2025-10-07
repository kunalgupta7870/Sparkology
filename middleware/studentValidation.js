const { body } = require('express-validator');

// Student creation validation
const studentValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Student name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),

  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('rollNumber')
    .trim()
    .notEmpty()
    .withMessage('Roll number is required')
    .isLength({ max: 20 })
    .withMessage('Roll number cannot exceed 20 characters'),

  body('admissionNumber')
    .trim()
    .notEmpty()
    .withMessage('Admission number is required')
    .isLength({ max: 20 })
    .withMessage('Admission number cannot exceed 20 characters'),

  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please enter a valid date of birth')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 3 || age > 25) {
        throw new Error('Student age must be between 3 and 25 years');
      }
      return true;
    }),

  body('gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('classId')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid class ID'),

  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 characters'),

  body('bloodGroup')
    .optional()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Please enter a valid blood group'),

  // Parent information validation
  body('parentInfo.fatherName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Father name cannot exceed 100 characters'),

  body('parentInfo.fatherEmail')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value);
    })
    .withMessage('Please enter a valid father email address')
    .normalizeEmail()
    .toLowerCase(),

  body('parentInfo.fatherPassword')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return value.length >= 6;
    })
    .withMessage('Father password must be at least 6 characters long'),

  body('parentInfo.fatherPhone')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return /^[\+]?[1-9][\d]{0,15}$/.test(value) && value.length >= 10 && value.length <= 15;
    })
    .withMessage('Father phone number must be between 10 and 15 characters'),

  body('parentInfo.motherName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Mother name cannot exceed 100 characters'),

  body('parentInfo.motherEmail')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value);
    })
    .withMessage('Please enter a valid mother email address'),

  body('parentInfo.motherPassword')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return value.length >= 6;
    })
    .withMessage('Mother password must be at least 6 characters long'),

  body('parentInfo.motherPhone')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return /^[\+]?[1-9][\d]{0,15}$/.test(value);
    })
    .withMessage('Please enter a valid mother phone number'),

  body('parentInfo.guardianName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Guardian name cannot exceed 100 characters'),

  body('parentInfo.guardianEmail')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value);
    })
    .withMessage('Please enter a valid guardian email address'),

  body('parentInfo.guardianPassword')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return value.length >= 6;
    })
    .withMessage('Guardian password must be at least 6 characters long'),

  body('parentInfo.guardianPhone')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty values
      }
      return /^[\+]?[1-9][\d]{0,15}$/.test(value);
    })
    .withMessage('Please enter a valid guardian phone number'),

  // Address validation
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters'),

  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City name cannot exceed 100 characters'),

  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State name cannot exceed 100 characters'),

  body('address.zipCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Zip code cannot exceed 20 characters'),

  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country name cannot exceed 100 characters'),

  // Medical information validation
  body('medicalInfo.allergies')
    .optional()
    .isArray()
    .withMessage('Allergies must be an array'),

  body('medicalInfo.medications')
    .optional()
    .isArray()
    .withMessage('Medications must be an array'),

  body('medicalInfo.emergencyContact.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Emergency contact name cannot exceed 100 characters'),

  body('medicalInfo.emergencyContact.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please enter a valid emergency contact phone number'),

  body('medicalInfo.emergencyContact.relationship')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Relationship cannot exceed 50 characters'),

  body('previousSchool')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Previous school name cannot exceed 200 characters')
];

// Student update validation (less strict)
const studentUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Student name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('rollNumber')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Roll number cannot be empty')
    .isLength({ max: 20 })
    .withMessage('Roll number cannot exceed 20 characters'),

  body('admissionNumber')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Admission number cannot be empty')
    .isLength({ max: 20 })
    .withMessage('Admission number cannot exceed 20 characters'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date of birth'),

  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('classId')
    .optional()
    .isMongoId()
    .withMessage('Please provide a valid class ID'),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please enter a valid phone number'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'graduated', 'transferred'])
    .withMessage('Status must be active, inactive, graduated, or transferred')
];

// Login validation
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

module.exports = {
  studentValidation,
  studentUpdateValidation,
  loginValidation
};
