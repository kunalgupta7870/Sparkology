const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createIDCard,
  getIDCards,
  getIDCard,
  getIDCardByPerson,
  updateIDCard,
  deleteIDCard
} = require('../controllers/idCardController');

// All routes require authentication
router.use(protect);

// Routes
router.route('/')
  .get(getIDCards)
  .post(createIDCard);

router.route('/person/:personId')
  .get(getIDCardByPerson);

router.route('/:id')
  .get(getIDCard)
  .put(updateIDCard)
  .delete(deleteIDCard);

module.exports = router;

