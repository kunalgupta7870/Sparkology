const express = require('express');
const router = express.Router();
const { submitApplication, getApplications, getApplicationById, updateStatus } = require('../controllers/admissionsController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');

router.use(protect);

// POST /api/admissions
router.post(
	'/',
	[
		body('name').notEmpty().withMessage('Name is required'),
		body('email').isEmail().withMessage('Valid email is required'),
		body('phone').notEmpty().withMessage('Phone is required'),
		body('class').notEmpty().withMessage('Class is required'),
		// Add more fields as per your AdmissionApplication schema
	],
	submitApplication
);

// GET /api/admissions
router.get('/', getApplications);

// GET /api/admissions/:id
router.get('/:id', getApplicationById);

// PUT /api/admissions/:id/status
router.put(
	'/:id/status',
	[
		body('status').isIn(['pending', 'approved', 'rejected']).withMessage('Status must be pending, approved, or rejected'),
	],
	updateStatus
);

module.exports = router;
