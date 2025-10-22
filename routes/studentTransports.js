const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getStudentTransports,
  getStudentTransport,
  createStudentTransport,
  updateStudentTransport,
  deleteStudentTransport,
  getStudentsByRoute,
  getActiveTransports,
  addAttendance,
  bulkAssignStudents,
  getUnassignedStudents
} = require('../controllers/studentTransportController');

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(getStudentTransports)
  .post(createStudentTransport);

router.route('/active')
  .get(getActiveTransports);

router.route('/unassigned')
  .get(getUnassignedStudents);

router.route('/bulk-assign')
  .post(bulkAssignStudents);

router.route('/route/:routeId')
  .get(getStudentsByRoute);

router.route('/:id')
  .get(getStudentTransport)
  .put(updateStudentTransport)
  .delete(deleteStudentTransport);

router.route('/:id/attendance')
  .post(addAttendance);

module.exports = router;

