const IDCard = require('../models/IDCard');
const Student = require('../models/Student');
const User = require('../models/User');
const School = require('../models/School');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Create/Save ID card
// @route   POST /api/id-cards
// @access  Private
const createIDCard = asyncHandler(async (req, res) => {
  const {
    personId,
    personModel,
    personName,
    personEmail,
    schoolId,
    schoolName,
    idNumber,
    classOrDept,
    role,
    template,
    schoolLogoUrl,
    personPhotoUrl,
    idCardImageUrl,
    academicYear
  } = req.body;

  // Validate required fields
  if (!personId || !personModel || !schoolId || !idNumber || !idCardImageUrl) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  // Check if person exists
  const PersonModel = personModel === 'Student' ? Student : User;
  const person = await PersonModel.findById(personId);
  if (!person) {
    return res.status(404).json({
      success: false,
      error: 'Person not found'
    });
  }

  // Check if school exists
  const school = await School.findById(schoolId);
  if (!school) {
    return res.status(404).json({
      success: false,
      error: 'School not found'
    });
  }

  // Check if ID card already exists for this person
  const existingCard = await IDCard.findOne({
    personId,
    personModel,
    schoolId,
    status: 'active'
  });

  if (existingCard) {
    // Update existing card
    existingCard.personName = personName || person.name;
    existingCard.personEmail = personEmail || person.email;
    existingCard.schoolName = schoolName || school.name;
    existingCard.idNumber = idNumber;
    existingCard.classOrDept = classOrDept;
    existingCard.role = role;
    existingCard.template = template || 'student-1';
    existingCard.schoolLogoUrl = schoolLogoUrl;
    existingCard.personPhotoUrl = personPhotoUrl;
    existingCard.idCardImageUrl = idCardImageUrl;
    existingCard.academicYear = academicYear || new Date().getFullYear().toString();
    existingCard.generatedBy = req.user._id;
    existingCard.generatedAt = new Date();

    await existingCard.save();

    return res.status(200).json({
      success: true,
      message: 'ID card updated successfully',
      data: existingCard
    });
  }

  // Create new ID card
  const idCard = await IDCard.create({
    personId,
    personModel,
    personName: personName || person.name,
    personEmail: personEmail || person.email,
    schoolId,
    schoolName: schoolName || school.name,
    idNumber,
    classOrDept,
    role,
    template: template || 'student-1',
    schoolLogoUrl,
    personPhotoUrl,
    idCardImageUrl,
    academicYear: academicYear || new Date().getFullYear().toString(),
    generatedBy: req.user._id
  });

  res.status(201).json({
    success: true,
    message: 'ID card created successfully',
    data: idCard
  });
});

// @desc    Get all ID cards
// @route   GET /api/id-cards
// @access  Private
const getIDCards = asyncHandler(async (req, res) => {
  const { schoolId, personId, personModel, role, status } = req.query;
  const query = {};

  // If user is school admin, only show cards from their school
  if (req.user.role === 'school_admin' && req.user.schoolId) {
    query.schoolId = req.user.schoolId;
  } else if (schoolId) {
    query.schoolId = schoolId;
  }

  if (personId) query.personId = personId;
  if (personModel) query.personModel = personModel;
  if (role) query.role = role;
  if (status) query.status = status;

  const idCards = await IDCard.find(query)
    .populate('schoolId', 'name code')
    .populate('generatedBy', 'name email')
    .sort({ generatedAt: -1 });

  res.status(200).json({
    success: true,
    count: idCards.length,
    data: idCards
  });
});

// @desc    Get single ID card
// @route   GET /api/id-cards/:id
// @access  Private
const getIDCard = asyncHandler(async (req, res) => {
  const idCard = await IDCard.findById(req.params.id)
    .populate('schoolId', 'name code')
    .populate('generatedBy', 'name email');

  if (!idCard) {
    return res.status(404).json({
      success: false,
      error: 'ID card not found'
    });
  }

  // Check access permissions
  if (req.user.role === 'school_admin' && idCard.schoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: idCard
  });
});

// @desc    Get ID card by person
// @route   GET /api/id-cards/person/:personId
// @access  Private
const getIDCardByPerson = asyncHandler(async (req, res) => {
  const { personId } = req.params;
  const { personModel } = req.query;

  const query = { personId, status: 'active' };
  if (personModel) query.personModel = personModel;

  const idCard = await IDCard.findOne(query)
    .populate('schoolId', 'name code')
    .populate('generatedBy', 'name email')
    .sort({ generatedAt: -1 });

  if (!idCard) {
    return res.status(404).json({
      success: false,
      error: 'ID card not found'
    });
  }

  // Check access permissions
  if (req.user.role === 'school_admin' && idCard.schoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  res.status(200).json({
    success: true,
    data: idCard
  });
});

// @desc    Update ID card
// @route   PUT /api/id-cards/:id
// @access  Private
const updateIDCard = asyncHandler(async (req, res) => {
  const idCard = await IDCard.findById(req.params.id);

  if (!idCard) {
    return res.status(404).json({
      success: false,
      error: 'ID card not found'
    });
  }

  // Check access permissions
  if (req.user.role === 'school_admin' && idCard.schoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  const {
    idNumber,
    classOrDept,
    template,
    schoolLogoUrl,
    personPhotoUrl,
    idCardImageUrl,
    status,
    academicYear
  } = req.body;

  if (idNumber) idCard.idNumber = idNumber;
  if (classOrDept) idCard.classOrDept = classOrDept;
  if (template) idCard.template = template;
  if (schoolLogoUrl !== undefined) idCard.schoolLogoUrl = schoolLogoUrl;
  if (personPhotoUrl !== undefined) idCard.personPhotoUrl = personPhotoUrl;
  if (idCardImageUrl) idCard.idCardImageUrl = idCardImageUrl;
  if (status) idCard.status = status;
  if (academicYear) idCard.academicYear = academicYear;

  await idCard.save();

  res.status(200).json({
    success: true,
    message: 'ID card updated successfully',
    data: idCard
  });
});

// @desc    Delete ID card
// @route   DELETE /api/id-cards/:id
// @access  Private
const deleteIDCard = asyncHandler(async (req, res) => {
  const idCard = await IDCard.findById(req.params.id);

  if (!idCard) {
    return res.status(404).json({
      success: false,
      error: 'ID card not found'
    });
  }

  // Check access permissions
  if (req.user.role === 'school_admin' && idCard.schoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  await idCard.deleteOne();

  res.status(200).json({
    success: true,
    message: 'ID card deleted successfully'
  });
});

module.exports = {
  createIDCard,
  getIDCards,
  getIDCard,
  getIDCardByPerson,
  updateIDCard,
  deleteIDCard
};

