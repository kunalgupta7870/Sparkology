const asyncHandler = require('../middleware/asyncHandler');
const Doubt = require('../models/Doubt');
const Student = require('../models/Student');
const SubjectCourse = require('../models/SubjectCourse');
const fs = require('fs');
const path = require('path');

// @desc    Get all doubts (filtered by various criteria)
// @route   GET /api/doubts
// @access  Private
const getDoubts = asyncHandler(async (req, res) => {
  const { filter, subjectCourse, status, subjectName, className } = req.query;
  
  let query = {};
  
  // For students, only show doubts from their school and class
  if (req.user.role === 'student') {
    // For students, req.user._id is the student ID directly
    const student = await Student.findById(req.user._id).populate('classId', 'name');
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found'
      });
    }
    
    // Only show answered doubts to students
    const baseQuery = { status: 'answered' };
    
    // Filter by student's class - show doubts for their class (both student-asked and admin-created)
    const studentClassName = student.classId?.name || student.className || '';
    if (studentClassName) {
      baseQuery.className = studentClassName;
    }
    
    // Show doubts from their school OR admin-created doubts without schoolId (for their class)
    query = {
      ...baseQuery,
      $or: [
        { schoolId: student.schoolId },
        { schoolId: null, createdByAdmin: { $exists: true } } // Admin-created doubts visible to all students of that class
      ]
    };
  }
  
  // For admin/master/school admin, show all doubts from their schools
  if (req.user.role === 'admin' || req.user.role === 'master' || req.user.role === 'schoolAdmin') {
    if (req.user.schoolId) {
      query.schoolId = req.user.schoolId;
    }
    // Apply status filter if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by subject name if provided
    if (subjectName) {
      query.subjectName = { $regex: subjectName, $options: 'i' };
    }
    
    // Filter by class name if provided
    if (className) {
      query.className = { $regex: className, $options: 'i' };
    }
  }
  
  // Filter by subject course if provided
  if (subjectCourse) {
    query.subjectCourse = subjectCourse;
  }
  
  let doubts;
  
  // Apply filter type
  if (filter === 'popular') {
    doubts = await Doubt.getPopularDoubts(query).limit(50);
  } else if (filter === 'recent') {
    doubts = await Doubt.getRecentDoubts(query).limit(50);
  } else if (filter === 'pending') {
    doubts = await Doubt.getPendingDoubts(query).limit(100);
  } else {
    // Default: show doubts based on status filter (if not set, defaults to all)
    doubts = await Doubt.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('student', 'name email className')
      .populate('createdByAdmin', 'name email')
      .populate('subjectCourse', 'title subjectName className')
      .populate('answer.answeredBy', 'name email');
  }
  
  res.json({
    success: true,
    count: doubts.length,
    data: doubts
  });
});

// @desc    Get single doubt
// @route   GET /api/doubts/:id
// @access  Private
const getDoubt = asyncHandler(async (req, res) => {
  const doubt = await Doubt.findById(req.params.id)
    .populate('student', 'name email className')
    .populate('createdByAdmin', 'name email')
    .populate('subjectCourse', 'title subjectName className')
    .populate('answer.answeredBy', 'name email');
  
  if (!doubt) {
    return res.status(404).json({
      success: false,
      error: 'Doubt not found'
    });
  }
  
  // Increment views
  await doubt.incrementViews();
  
  res.json({
    success: true,
    data: doubt
  });
});

// @desc    Create new doubt
// @route   POST /api/doubts
// @access  Private (Student)
const createDoubt = asyncHandler(async (req, res) => {
  const { subjectCourseId, question } = req.body;
  
  // Get student profile with populated class - for students, req.user._id is the student ID directly
  const student = await Student.findById(req.user._id).populate('classId', 'name section');
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student profile not found'
    });
  }
  
  // Verify subject course exists
  const subjectCourse = await SubjectCourse.findById(subjectCourseId);
  if (!subjectCourse) {
    return res.status(404).json({
      success: false,
      error: 'Subject course not found'
    });
  }
  
  // Get student's class name from the populated classId
  const studentClassName = student.classId?.name || student.className || '';
  const courseClassName = subjectCourse.className || '';
  
  console.log('Student class name:', studentClassName);
  console.log('SubjectCourse class name:', courseClassName);
  
  // Verify subject course matches student's class (case-insensitive and trim whitespace)
  const studentClass = String(studentClassName).trim();
  const courseClass = String(courseClassName).trim();
  
  if (studentClass.toLowerCase() !== courseClass.toLowerCase()) {
    console.log('Class mismatch!');
    console.log('Student class (trimmed):', studentClass);
    console.log('Course class (trimmed):', courseClass);
    return res.status(400).json({
      success: false,
      error: `Subject course does not match your class. Your class: "${studentClass}", Course class: "${courseClass}"`
    });
  }
  
  const doubtData = {
    student: student._id,
    subjectCourse: subjectCourseId,
    subjectName: subjectCourse.subjectName,
    question,
    schoolId: student.schoolId,
    className: studentClassName
  };
  
  // Handle document upload if file is present
  if (req.file) {
    try {
      // Store the file path relative to the uploads folder
      // File is already saved by multer to uploads/documents/
      const relativePath = req.file.path.replace(/\\/g, '/'); // Normalize path separators
      doubtData.document = {
        url: `/${relativePath}`, // e.g., /uploads/documents/doubt-1234567890.pdf
        publicId: req.file.filename, // Store filename as publicId for reference
        name: req.file.originalname
      };
      console.log('Document saved locally:', doubtData.document);
    } catch (error) {
      console.error('Document upload error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload document'
      });
    }
  }
  
  const doubt = await Doubt.create(doubtData);
  
  // Populate the response
  const populatedDoubt = await Doubt.findById(doubt._id)
    .populate('student', 'name email')
    .populate('subjectCourse', 'title subjectName');
  
  res.status(201).json({
    success: true,
    message: 'Doubt posted successfully',
    data: populatedDoubt
  });
});

// @desc    Create admin doubt
// @route   POST /api/doubts/admin-create
// @access  Private (Admin, Master, School Admin)
const createAdminDoubt = asyncHandler(async (req, res) => {
  const { subjectCourseId, question, answer, className } = req.body;
  
  // Verify user is admin/master/school admin
  if (req.user.role !== 'admin' && req.user.role !== 'master' && req.user.role !== 'schoolAdmin') {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to create admin doubts'
    });
  }
  
  // Verify subject course exists
  const subjectCourse = await SubjectCourse.findById(subjectCourseId);
  if (!subjectCourse) {
    return res.status(404).json({
      success: false,
      error: 'Subject course not found'
    });
  }
  
  // Use provided className or get from subjectCourse
  const doubtClassName = className || subjectCourse.className || '';
  if (!doubtClassName) {
    return res.status(400).json({
      success: false,
      error: 'Class name is required'
    });
  }
  
  // Get schoolId from user or subject course's school
  let schoolId = req.user.schoolId;
  // If master/admin without schoolId, try to get from subject course if it has schoolId
  // For now, master/admin can create doubts for any school (set schoolId to null or get from context)
  // For school admin, use their schoolId
  
  const doubtData = {
    createdByAdmin: req.user._id,
    subjectCourse: subjectCourseId,
    subjectName: subjectCourse.subjectName,
    question,
    schoolId: schoolId || null, // For master/admin, may be null
    className: doubtClassName,
    status: answer ? 'answered' : 'pending'
  };
  
  // If answer is provided, add it
  if (answer && answer.trim()) {
    doubtData.answer = {
      text: answer.trim(),
      answeredBy: req.user._id,
      answeredAt: new Date()
    };
    doubtData.status = 'answered';
  }
  
  // Handle document upload if file is present
  if (req.file) {
    try {
      const relativePath = req.file.path.replace(/\\/g, '/');
      doubtData.document = {
        url: `/${relativePath}`,
        publicId: req.file.filename,
        name: req.file.originalname
      };
      console.log('Document saved locally:', doubtData.document);
    } catch (error) {
      console.error('Document upload error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload document'
      });
    }
  }
  
  const doubt = await Doubt.create(doubtData);
  
  // Populate the response
  const populatedDoubt = await Doubt.findById(doubt._id)
    .populate('createdByAdmin', 'name email')
    .populate('subjectCourse', 'title subjectName className')
    .populate('answer.answeredBy', 'name email');
  
  res.status(201).json({
    success: true,
    message: 'Admin doubt created successfully',
    data: populatedDoubt
  });
});

// @desc    Answer a doubt
// @route   PUT /api/doubts/:id/answer
// @access  Private (Admin, Master, School Admin)
const answerDoubt = asyncHandler(async (req, res) => {
  const { answer } = req.body;
  
  if (!answer || !answer.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Answer is required'
    });
  }
  
  const doubt = await Doubt.findById(req.params.id);
  
  if (!doubt) {
    return res.status(404).json({
      success: false,
      error: 'Doubt not found'
    });
  }
  
  // Verify user has permission to answer (same school or master/admin)
  // Master/admin can answer any doubt, school admin can only answer doubts from their school
  if (req.user.role !== 'master' && req.user.role !== 'admin') {
    if (!req.user.schoolId || doubt.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to answer this doubt'
      });
    }
  }
  
  await doubt.answerDoubt(answer, req.user._id);
  
  // Populate the response
  const updatedDoubt = await Doubt.findById(doubt._id)
    .populate('student', 'name email')
    .populate('createdByAdmin', 'name email')
    .populate('subjectCourse', 'title subjectName')
    .populate('answer.answeredBy', 'name email');
  
  res.json({
    success: true,
    message: 'Doubt answered successfully',
    data: updatedDoubt
  });
});

// @desc    Toggle bookmark on a doubt
// @route   PUT /api/doubts/:id/bookmark
// @access  Private (Student)
const toggleBookmark = asyncHandler(async (req, res) => {
  // For students, req.user._id is the student ID directly
  const student = await Student.findById(req.user._id).populate('classId', 'name');
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student profile not found'
    });
  }
  
  const doubt = await Doubt.findById(req.params.id);
  
  if (!doubt) {
    return res.status(404).json({
      success: false,
      error: 'Doubt not found'
    });
  }
  
  await doubt.toggleBookmark(student._id);
  
  res.json({
    success: true,
    message: 'Bookmark toggled successfully',
    data: {
      isBookmarked: doubt.isBookmarked.includes(student._id)
    }
  });
});

// @desc    Mark doubt as helpful
// @route   PUT /api/doubts/:id/helpful
// @access  Private (Student)
const markHelpful = asyncHandler(async (req, res) => {
  const doubt = await Doubt.findById(req.params.id);
  
  if (!doubt) {
    return res.status(404).json({
      success: false,
      error: 'Doubt not found'
    });
  }
  
  if (doubt.status !== 'answered') {
    return res.status(400).json({
      success: false,
      error: 'Cannot mark unanswered doubt as helpful'
    });
  }
  
  await doubt.markHelpful();
  
  res.json({
    success: true,
    message: 'Marked as helpful',
    data: {
      helpful: doubt.helpful
    }
  });
});

// @desc    Get my doubts (student's own doubts)
// @route   GET /api/doubts/my-doubts
// @access  Private (Student)
const getMyDoubts = asyncHandler(async (req, res) => {
  // For students, req.user._id is the student ID directly
  const student = await Student.findById(req.user._id).populate('classId', 'name');
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student profile not found'
    });
  }
  
  const doubts = await Doubt.find({ student: student._id })
    .sort({ createdAt: -1 })
    .populate('subjectCourse', 'title subjectName')
    .populate('answer.answeredBy', 'name email');
  
  res.json({
    success: true,
    count: doubts.length,
    data: doubts
  });
});

// @desc    Get saved/bookmarked doubts
// @route   GET /api/doubts/saved
// @access  Private (Student)
const getSavedDoubts = asyncHandler(async (req, res) => {
  // For students, req.user._id is the student ID directly
  const student = await Student.findById(req.user._id).populate('classId', 'name');
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student profile not found'
    });
  }
  
  const doubts = await Doubt.find({ 
    isBookmarked: student._id,
    status: 'answered'
  })
    .sort({ createdAt: -1 })
    .populate('student', 'name email')
    .populate('subjectCourse', 'title subjectName')
    .populate('answer.answeredBy', 'name email');
  
  res.json({
    success: true,
    count: doubts.length,
    data: doubts
  });
});

// @desc    Delete a doubt
// @route   DELETE /api/doubts/:id
// @access  Private (Student owns it, or Admin)
const deleteDoubt = asyncHandler(async (req, res) => {
  const doubt = await Doubt.findById(req.params.id);
  
  if (!doubt) {
    return res.status(404).json({
      success: false,
      error: 'Doubt not found'
    });
  }
  
  // Check if user is authorized to delete
  if (req.user.role === 'student') {
    // For students, req.user._id is the student ID directly
    if (doubt.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this doubt'
      });
    }
  }
  
  // Delete document from local uploads folder if exists
  if (doubt.document && doubt.document.url) {
    try {
      const fs = require('fs');
      const path = require('path');
      // Get the file path from the URL
      const filePath = path.join(__dirname, '..', doubt.document.url);
      // Check if file exists and delete it
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Document deleted from uploads folder:', filePath);
      }
    } catch (error) {
      console.error('Error deleting document from uploads folder:', error);
    }
  }
  
  await doubt.deleteOne();
  
  res.json({
    success: true,
    message: 'Doubt deleted successfully'
  });
});

// @desc    Get subject courses for student's class (backup endpoint - not used in app)
// @route   GET /api/doubts/subject-courses
// @access  Private (Student)
const getSubjectCoursesForDoubt = asyncHandler(async (req, res) => {
  // For students, req.user._id is the student ID directly
  const student = await Student.findById(req.user._id).populate('classId', 'name');
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student profile not found'
    });
  }
  
  // Get student's class name from the populated classId
  const studentClassName = student.classId?.name || student.className || '';
  
  const subjectCourses = await SubjectCourse.find({ 
    className: studentClassName 
  })
    .select('_id title subjectName className')
    .sort({ subjectName: 1 });
  
  res.json({
    success: true,
    count: subjectCourses.length,
    data: subjectCourses
  });
});

module.exports = {
  getDoubts,
  getDoubt,
  createDoubt,
  createAdminDoubt,
  answerDoubt,
  toggleBookmark,
  markHelpful,
  getMyDoubts,
  getSavedDoubts,
  deleteDoubt,
  getSubjectCoursesForDoubt
};

