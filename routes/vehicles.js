const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getActiveVehicles,
  getAvailableVehicles,
  assignRoute,
  assignDriver,
  addMaintenanceRecord
} = require('../controllers/vehicleController');

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(getVehicles)
  .post(createVehicle);

router.route('/active')
  .get(getActiveVehicles);

router.route('/available')
  .get(getAvailableVehicles);

router.route('/:id')
  .get(getVehicle)
  .put(updateVehicle)
  .delete(deleteVehicle);

router.route('/:id/assign-route')
  .put(assignRoute);

router.route('/:id/assign-driver')
  .put(assignDriver);

router.route('/:id/maintenance')
  .post(addMaintenanceRecord);

module.exports = router;

