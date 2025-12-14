const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getHouses,
  getHouse,
  createHouse,
  updateHouse,
  deleteHouse,
  assignStudents,
  removeStudents
} = require('../controllers/houseController');

const router = express.Router();

// All routes require authentication and school_admin role
router.use(protect);
router.use(authorize('school_admin'));

router.route('/')
  .get(getHouses)
  .post(createHouse);

router.route('/:id')
  .get(getHouse)
  .put(updateHouse)
  .delete(deleteHouse);

router.route('/:id/assign-students')
  .post(assignStudents);

router.route('/:id/remove-students')
  .post(removeStudents);

module.exports = router;

