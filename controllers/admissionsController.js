const AdmissionApplication = require('../models/AdmissionApplication');
const { validationResult } = require('express-validator');

const submitApplication = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const createdBy = req.user._id;
    
    // Validate required fields
    const { studentName, dateOfBirth, gender, classApplied, academicYear, parentDetails, address } = req.body;
    
    if (!studentName) return res.status(400).json({ success: false, error: 'Student name is required' });
    if (!dateOfBirth) return res.status(400).json({ success: false, error: 'Date of birth is required' });
    if (!gender) return res.status(400).json({ success: false, error: 'Gender is required' });
    if (!classApplied) return res.status(400).json({ success: false, error: 'Class is required' });
    if (!academicYear) return res.status(400).json({ success: false, error: 'Academic year is required' });
    if (!parentDetails || !parentDetails.name) return res.status(400).json({ success: false, error: 'Parent name is required' });
    if (!parentDetails || !parentDetails.contact) return res.status(400).json({ success: false, error: 'Parent contact is required' });
    if (!parentDetails || !parentDetails.email) return res.status(400).json({ success: false, error: 'Parent email is required' });

    const data = { ...req.body, schoolId, createdBy };

    const application = await AdmissionApplication.create(data);

    res.status(201).json({ success: true, message: 'Application submitted', data: application });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error while submitting application' });
  }
};

const getApplications = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { page = 1, limit = 50, status } = req.query;
    const query = { schoolId, isActive: true };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const items = await AdmissionApplication.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await AdmissionApplication.countDocuments(query);

    res.json({ success: true, data: items, pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total/parseInt(limit)), totalItems: total } });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching applications' });
  }
};

const getApplicationById = async (req, res) => {
  try {
    const application = await AdmissionApplication.findOne({ _id: req.params.id, schoolId: req.user.schoolId, isActive: true });
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Get application by id error:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching application' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending','approved','rejected'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    const application = await AdmissionApplication.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });

    application.status = status;
    await application.save();

    res.json({ success: true, message: 'Application status updated', data: application });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ success: false, error: 'Server error while updating status' });
  }
};

module.exports = {
  submitApplication,
  getApplications,
  getApplicationById,
  updateStatus
};
