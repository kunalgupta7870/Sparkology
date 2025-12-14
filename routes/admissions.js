const express = require('express');
const router = express.Router();
const { submitApplication, getApplications, getApplicationById, updateStatus } = require('../controllers/admissionsController');
const { protect } = require('../middleware/auth');

router.use(protect);

// POST /api/admissions
router.post('/', submitApplication);

// GET /api/admissions
router.get('/', getApplications);

// GET /api/admissions/:id
router.get('/:id', getApplicationById);

// PUT /api/admissions/:id/status
router.put('/:id/status', updateStatus);

module.exports = router;
