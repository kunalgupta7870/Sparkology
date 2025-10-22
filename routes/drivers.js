const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getDrivers,
  getDriver,
  createDriver,
  updateDriver,
  deleteDriver,
  getActiveDrivers,
  getAvailableDrivers,
  assignVehicle,
  assignRoute,
  addTrainingCertificate,
  addDisciplinaryRecord
} = require('../controllers/driverController');

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(getDrivers)
  .post(createDriver);

router.route('/active')
  .get(getActiveDrivers);

router.route('/available')
  .get(getAvailableDrivers);

router.route('/:id')
  .get(getDriver)
  .put(updateDriver)
  .delete(deleteDriver);

router.route('/:id/assign-vehicle')
  .put(assignVehicle);

router.route('/:id/assign-route')
  .put(assignRoute);

router.route('/:id/training')
  .post(addTrainingCertificate);

router.route('/:id/disciplinary')
  .post(addDisciplinaryRecord);

module.exports = router;

