const Announcement = require('../models/Announcement');
const ImportantDate = require('../models/ImportantDate');
const { validationResult } = require('express-validator');

// Create announcement
const createAnnouncement = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const schoolId = req.user.schoolId;
    const createdBy = req.user._id;

    const { title, content, date, type = 'general', priority = 'normal', classes = [], applyToAllClasses = true, attachments = [] } = req.body;

    const announcement = await Announcement.create({
      title,
      content,
      date: date ? new Date(date) : undefined,
      type,
      priority,
      schoolId,
      classes: applyToAllClasses ? [] : classes,
      applyToAllClasses,
      attachments,
      createdBy
    });

    // If announcement has a date, create a corresponding ImportantDate so parent app can pick it up
    if (announcement.date) {
      try {
        const important = await ImportantDate.create({
          title: announcement.title,
          description: announcement.content,
          date: announcement.date,
          type: announcement.type === 'holiday' ? 'holiday' : 'event',
          priority: announcement.priority || 'normal',
          schoolId: announcement.schoolId,
          classes: announcement.classes || [],
          applyToAllClasses: announcement.applyToAllClasses,
          createdBy: announcement.createdBy
        });

        // Emit via websocket if available
        if (global.io) {
          global.io.to(`school_${schoolId}`).emit('important_date_created', { type: 'important_date_created', importantDate: important, schoolId });
        }
      } catch (innerErr) {
        console.error('Failed to create corresponding ImportantDate for announcement:', innerErr);
      }
    }

    res.status(201).json({ success: true, message: 'Announcement created', data: announcement });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, error: 'Server error while creating announcement' });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { schoolId, isActive: true };

    const items = await Announcement.find(query)
      .populate('createdBy', 'name email')
      .populate('classes', 'name section')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Announcement.countDocuments(query);

    res.json({ success: true, data: items, pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), totalItems: total } });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching announcements' });
  }
};

const getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findOne({ _id: req.params.id, schoolId: req.user.schoolId, isActive: true })
      .populate('createdBy', 'name email')
      .populate('classes', 'name section');

    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });

    res.json({ success: true, data: announcement });
  } catch (error) {
    console.error('Get announcement by id error:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching announcement' });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });

    Object.assign(announcement, req.body, { updatedAt: new Date() });
    await announcement.save();

    res.json({ success: true, message: 'Announcement updated', data: announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, error: 'Server error while updating announcement' });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });

    announcement.isActive = false;
    await announcement.save();

    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, error: 'Server error while deleting announcement' });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement
};
