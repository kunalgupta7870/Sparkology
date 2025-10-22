const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getRoutes,
  getRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  getActiveRoutes,
  getRouteStats
} = require('../controllers/routeController');

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(getRoutes)
  .post(createRoute);

router.route('/active')
  .get(getActiveRoutes);

router.route('/:id')
  .get(getRoute)
  .put(updateRoute)
  .delete(deleteRoute);

router.route('/:id/stats')
  .get(getRouteStats);

module.exports = router;

