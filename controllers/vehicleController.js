const Vehicle = require('../models/Vehicle');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all vehicles for a school
// @route   GET /api/vehicles
// @access  Private
exports.getVehicles = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const vehicles = await Vehicle.find({ schoolId })
    .populate('routeId', 'name routeNumber startPoint endPoint')
    .populate('driverId', 'name licenseNumber phone')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: vehicles.length,
    data: vehicles
  });
});

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Private
exports.getVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id)
    .populate('routeId', 'name routeNumber')
    .populate('driverId', 'name licenseNumber phone');
  
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: vehicle
  });
});

// @desc    Create new vehicle
// @route   POST /api/vehicles
// @access  Private
exports.createVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.create(req.body);
  
  res.status(201).json({
    success: true,
    message: 'Vehicle created successfully',
    data: vehicle
  });
});

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private
exports.updateVehicle = asyncHandler(async (req, res) => {
  let vehicle = await Vehicle.findById(req.params.id);
  
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found'
    });
  }
  
  vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('routeId', 'name routeNumber')
    .populate('driverId', 'name licenseNumber phone');
  
  res.status(200).json({
    success: true,
    message: 'Vehicle updated successfully',
    data: vehicle
  });
});

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private
exports.deleteVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found'
    });
  }
  
  // Check if vehicle is assigned to a route
  if (vehicle.routeId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete vehicle. It is currently assigned to a route. Please unassign it first.'
    });
  }
  
  // Check if vehicle is assigned to a driver
  if (vehicle.driverId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete vehicle. It is currently assigned to a driver. Please unassign it first.'
    });
  }
  
  await vehicle.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Vehicle deleted successfully',
    data: {}
  });
});

// @desc    Get active vehicles for a school
// @route   GET /api/vehicles/active
// @access  Private
exports.getActiveVehicles = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const vehicles = await Vehicle.getActiveVehicles(schoolId);
  
  res.status(200).json({
    success: true,
    count: vehicles.length,
    data: vehicles
  });
});

// @desc    Get available vehicles (not assigned)
// @route   GET /api/vehicles/available
// @access  Private
exports.getAvailableVehicles = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const vehicles = await Vehicle.getAvailableVehicles(schoolId);
  
  res.status(200).json({
    success: true,
    count: vehicles.length,
    data: vehicles
  });
});

// @desc    Assign vehicle to route
// @route   PUT /api/vehicles/:id/assign-route
// @access  Private
exports.assignRoute = asyncHandler(async (req, res) => {
  const { routeId } = req.body;
  
  const vehicle = await Vehicle.findById(req.params.id);
  
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found'
    });
  }
  
  vehicle.routeId = routeId;
  await vehicle.save();
  
  res.status(200).json({
    success: true,
    message: 'Route assigned successfully',
    data: vehicle
  });
});

// @desc    Assign driver to vehicle
// @route   PUT /api/vehicles/:id/assign-driver
// @access  Private
exports.assignDriver = asyncHandler(async (req, res) => {
  const { driverId } = req.body;
  
  const vehicle = await Vehicle.findById(req.params.id);
  
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found'
    });
  }
  
  vehicle.driverId = driverId;
  await vehicle.save();
  
  // Update driver's vehicleId
  const Driver = require('../models/Driver');
  await Driver.findByIdAndUpdate(driverId, { vehicleId: req.params.id });
  
  res.status(200).json({
    success: true,
    message: 'Driver assigned successfully',
    data: vehicle
  });
});

// @desc    Add maintenance record
// @route   POST /api/vehicles/:id/maintenance
// @access  Private
exports.addMaintenanceRecord = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found'
    });
  }
  
  vehicle.maintenanceHistory.push(req.body);
  vehicle.lastMaintenanceDate = req.body.date;
  await vehicle.save();
  
  res.status(200).json({
    success: true,
    message: 'Maintenance record added successfully',
    data: vehicle
  });
});

