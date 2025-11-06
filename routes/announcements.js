const express = require('express');
const router = express.Router();
const { createAnnouncement, getAnnouncements, getAnnouncementById, updateAnnouncement, deleteAnnouncement } = require('../controllers/announcementController');
const { protect } = require('../middleware/auth');

router.use(protect);

// POST /api/announcements
router.post('/', createAnnouncement);

// GET /api/announcements
router.get('/', getAnnouncements);

// GET /api/announcements/:id
router.get('/:id', getAnnouncementById);

// PUT /api/announcements/:id
router.put('/:id', updateAnnouncement);

// DELETE /api/announcements/:id
router.delete('/:id', deleteAnnouncement);

module.exports = router;
