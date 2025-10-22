const Driver = require('../models/Driver');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all drivers for a school
// @route   GET /api/drivers
// @access  Private
exports.getDrivers = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const drivers = await Driver.find({ schoolId })
    .populate('vehicleId', 'vehicleNumber vehicleType registrationNumber')
    .populate('routeId', 'name routeNumber startPoint endPoint')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: drivers.length,
    data: drivers
  });
});

// @desc    Get single driver
// @route   GET /api/drivers/:id
// @access  Private
exports.getDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id)
    .populate('vehicleId', 'vehicleNumber vehicleType registrationNumber')
    .populate('routeId', 'name routeNumber');
  
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: driver
  });
});

// @desc    Create new driver
// @route   POST /api/drivers
// @access  Private
exports.createDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.create(req.body);
  
  res.status(201).json({
    success: true,
    message: 'Driver created successfully',
    data: driver
  });
});

// @desc    Update driver
// @route   PUT /api/drivers/:id
// @access  Private
exports.updateDriver = asyncHandler(async (req, res) => {
  let driver = await Driver.findById(req.params.id);
  
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }
  
  driver = await Driver.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('vehicleId', 'vehicleNumber vehicleType')
    .populate('routeId', 'name routeNumber');
  
  res.status(200).json({
    success: true,
    message: 'Driver updated successfully',
    data: driver
  });
});

// @desc    Delete driver
// @route   DELETE /api/drivers/:id
// @access  Private
exports.deleteDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }
  
  // Check if driver is assigned to a vehicle
  if (driver.vehicleId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete driver. Driver is currently assigned to a vehicle. Please unassign first.'
    });
  }
  
  await driver.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Driver deleted successfully',
    data: {}
  });
});

// @desc    Get active drivers for a school
// @route   GET /api/drivers/active
// @access  Private
exports.getActiveDrivers = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const drivers = await Driver.getActiveDrivers(schoolId);
  
  res.status(200).json({
    success: true,
    count: drivers.length,
    data: drivers
  });
});

// @desc    Get available drivers (not assigned)
// @route   GET /api/drivers/available
// @access  Private
exports.getAvailableDrivers = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const drivers = await Driver.getAvailableDrivers(schoolId);
  
  res.status(200).json({
    success: true,
    count: drivers.length,
    data: drivers
  });
});

// @desc    Assign vehicle to driver
// @route   PUT /api/drivers/:id/assign-vehicle
// @access  Private
exports.assignVehicle = asyncHandler(async (req, res) => {
  const { vehicleId } = req.body;
  
  const driver = await Driver.findById(req.params.id);
  
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }
  
  // Check if vehicle is already assigned to another driver
  const existingAssignment = await Driver.findOne({ 
    vehicleId, 
    _id: { $ne: req.params.id } 
  });
  
  if (existingAssignment) {
    return res.status(400).json({
      success: false,
      message: 'This vehicle is already assigned to another driver'
    });
  }
  
  driver.vehicleId = vehicleId;
  await driver.save();
  
  // Update vehicle's driverId
  const Vehicle = require('../models/Vehicle');
  await Vehicle.findByIdAndUpdate(vehicleId, { driverId: req.params.id });
  
  res.status(200).json({
    success: true,
    message: 'Vehicle assigned successfully',
    data: driver
  });
});

// @desc    Assign route to driver
// @route   PUT /api/drivers/:id/assign-route
// @access  Private
exports.assignRoute = asyncHandler(async (req, res) => {
  const { routeId } = req.body;
  
  const driver = await Driver.findById(req.params.id);
  
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }
  
  driver.routeId = routeId;
  await driver.save();
  
  res.status(200).json({
    success: true,
    message: 'Route assigned successfully',
    data: driver
  });
});

// @desc    Add training certificate
// @route   POST /api/drivers/:id/training
// @access  Private
exports.addTrainingCertificate = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }
  
  driver.trainingCertificates.push(req.body);
  await driver.save();
  
  res.status(200).json({
    success: true,
    message: 'Training certificate added successfully',
    data: driver
  });
});

// @desc    Add disciplinary record
// @route   POST /api/drivers/:id/disciplinary
// @access  Private
exports.addDisciplinaryRecord = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  
  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }
  
  driver.disciplinaryRecords.push(req.body);
  await driver.save();
  
  res.status(200).json({
    success: true,
    message: 'Disciplinary record added successfully',
    data: driver
  });
});

