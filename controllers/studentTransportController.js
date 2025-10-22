const StudentTransport = require('../models/StudentTransport');
const Student = require('../models/Student');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all student transports for a school
// @route   GET /api/student-transports
// @access  Private
exports.getStudentTransports = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const transports = await StudentTransport.find({ schoolId })
    .populate({
      path: 'studentId',
      select: 'name rollNumber email phone classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate('routeId', 'name routeNumber startPoint endPoint distance')
    .populate('vehicleId', 'vehicleNumber vehicleType capacity')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: transports.length,
    data: transports
  });
});

// @desc    Get single student transport
// @route   GET /api/student-transports/:id
// @access  Private
exports.getStudentTransport = asyncHandler(async (req, res) => {
  const transport = await StudentTransport.findById(req.params.id)
    .populate({
      path: 'studentId',
      select: 'name rollNumber email phone classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate('routeId', 'name routeNumber startPoint endPoint')
    .populate('vehicleId', 'vehicleNumber vehicleType');
  
  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: transport
  });
});

// @desc    Create new student transport
// @route   POST /api/student-transports
// @access  Private
exports.createStudentTransport = asyncHandler(async (req, res) => {
  const { studentId, routeId, schoolId } = req.body;
  
  // Check if student already has an active transport assignment
  const existingTransport = await StudentTransport.findOne({
    studentId,
    status: 'active'
  });
  
  if (existingTransport) {
    return res.status(400).json({
      success: false,
      message: 'Student already has an active transport assignment'
    });
  }
  
  // Verify student exists and belongs to the school
  const student = await Student.findOne({ _id: studentId, schoolId });
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found or does not belong to this school'
    });
  }
  
  const transport = await StudentTransport.create(req.body);
  
  const populatedTransport = await StudentTransport.findById(transport._id)
    .populate('studentId', 'name rollNumber email')
    .populate('routeId', 'name routeNumber')
    .populate('vehicleId', 'vehicleNumber vehicleType');
  
  res.status(201).json({
    success: true,
    message: 'Student transport assigned successfully',
    data: populatedTransport
  });
});

// @desc    Update student transport
// @route   PUT /api/student-transports/:id
// @access  Private
exports.updateStudentTransport = asyncHandler(async (req, res) => {
  let transport = await StudentTransport.findById(req.params.id);
  
  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }
  
  transport = await StudentTransport.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    {
      new: true,
      runValidators: true
    }
  ).populate('studentId', 'name rollNumber email')
   .populate('routeId', 'name routeNumber')
   .populate('vehicleId', 'vehicleNumber vehicleType');
  
  res.status(200).json({
    success: true,
    message: 'Student transport updated successfully',
    data: transport
  });
});

// @desc    Delete student transport
// @route   DELETE /api/student-transports/:id
// @access  Private
exports.deleteStudentTransport = asyncHandler(async (req, res) => {
  const transport = await StudentTransport.findById(req.params.id);
  
  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }
  
  await transport.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Student transport assignment deleted successfully',
    data: {}
  });
});

// @desc    Get students by route
// @route   GET /api/student-transports/route/:routeId
// @access  Private
exports.getStudentsByRoute = asyncHandler(async (req, res) => {
  const students = await StudentTransport.getStudentsByRoute(req.params.routeId);
  
  res.status(200).json({
    success: true,
    count: students.length,
    data: students
  });
});

// @desc    Get active student transports
// @route   GET /api/student-transports/active
// @access  Private
exports.getActiveTransports = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const transports = await StudentTransport.getActiveTransports(schoolId);
  
  res.status(200).json({
    success: true,
    count: transports.length,
    data: transports
  });
});

// @desc    Add attendance record
// @route   POST /api/student-transports/:id/attendance
// @access  Private
exports.addAttendance = asyncHandler(async (req, res) => {
  const transport = await StudentTransport.findById(req.params.id);
  
  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }
  
  const { date, status, pickupTime, dropTime, remarks } = req.body;
  
  await transport.addAttendance(date, status, pickupTime, dropTime, remarks);
  
  res.status(200).json({
    success: true,
    message: 'Attendance record added successfully',
    data: transport
  });
});

// @desc    Bulk assign students to transport
// @route   POST /api/student-transports/bulk-assign
// @access  Private
exports.bulkAssignStudents = asyncHandler(async (req, res) => {
  const { students, routeId, vehicleId, pickupPoint, pickupTime, schoolId } = req.body;
  
  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Students array is required'
    });
  }
  
  const createdTransports = [];
  const errors = [];
  
  for (const studentId of students) {
    try {
      // Check if student already has active transport
      const existingTransport = await StudentTransport.findOne({
        studentId,
        status: 'active'
      });
      
      if (existingTransport) {
        errors.push({
          studentId,
          message: 'Already has active transport'
        });
        continue;
      }
      
      const transport = await StudentTransport.create({
        studentId,
        routeId,
        vehicleId,
        pickupPoint,
        pickupTime,
        schoolId,
        status: 'active'
      });
      
      createdTransports.push(transport);
    } catch (error) {
      errors.push({
        studentId,
        message: error.message
      });
    }
  }
  
  res.status(201).json({
    success: true,
    message: `${createdTransports.length} students assigned successfully`,
    data: {
      created: createdTransports.length,
      errors: errors.length,
      errorDetails: errors
    }
  });
});

// @desc    Get unassigned students (students without transport)
// @route   GET /api/student-transports/unassigned
// @access  Private
exports.getUnassignedStudents = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  // Get all students from the school
  const allStudents = await Student.find({ 
    schoolId, 
    status: 'active' 
  }).select('name rollNumber email classId').populate('classId', 'name section');
  
  // Get all students with active transport
  const assignedTransports = await StudentTransport.find({
    schoolId,
    status: 'active'
  }).select('studentId');
  
  const assignedStudentIds = assignedTransports.map(t => t.studentId.toString());
  
  // Filter out assigned students
  const unassignedStudents = allStudents.filter(
    student => !assignedStudentIds.includes(student._id.toString())
  );
  
  res.status(200).json({
    success: true,
    count: unassignedStudents.length,
    data: unassignedStudents
  });
});

