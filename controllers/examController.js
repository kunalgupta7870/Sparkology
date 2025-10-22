const Exam = require('../models/Exam');
const ExamMark = require('../models/ExamMark');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all exams
// @route   GET /api/exams
// @access  Private
exports.getExams = asyncHandler(async (req, res) => {
  const { schoolId, classId, subjectId, status } = req.query;
  
  const filter = {};
  if (schoolId) filter.schoolId = schoolId;
  if (classId) filter.classId = classId;
  if (subjectId) filter.subjectId = subjectId;
  if (status) filter.status = status;
  
  const exams = await Exam.find(filter)
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('createdBy', 'name email')
    .sort({ examDate: -1 });
  
  res.status(200).json({
    success: true,
    count: exams.length,
    data: exams
  });
});

// @desc    Get single exam
// @route   GET /api/exams/:id
// @access  Private
exports.getExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id)
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
  
  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: exam
  });
});

// @desc    Create new exam
// @route   POST /api/exams
// @access  Private
exports.createExam = asyncHandler(async (req, res) => {
  // Add user info to request body
  req.body.createdBy = req.user.id;
  
  const exam = await Exam.create(req.body);
  
  const populatedExam = await Exam.findById(exam._id)
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('createdBy', 'name email');
  
  res.status(201).json({
    success: true,
    data: populatedExam
  });
});

// @desc    Update exam
// @route   PUT /api/exams/:id
// @access  Private
exports.updateExam = asyncHandler(async (req, res) => {
  let exam = await Exam.findById(req.params.id);
  
  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }
  
  // Add user info for update tracking
  req.body.updatedBy = req.user.id;
  
  exam = await Exam.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  )
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('updatedBy', 'name email');
  
  res.status(200).json({
    success: true,
    data: exam
  });
});

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Private
exports.deleteExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  
  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }
  
  // Delete associated marks
  await ExamMark.deleteMany({ examId: req.params.id });
  
  await exam.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get exam statistics for overview
// @route   GET /api/exams/stats/overview
// @access  Private
exports.getExamStats = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      error: 'School ID is required'
    });
  }
  
  // Total exams
  const totalExams = await Exam.countDocuments({ schoolId });
  
  // Active exams (upcoming and ongoing)
  const activeExams = await Exam.countDocuments({
    schoolId,
    status: { $in: ['upcoming', 'ongoing'] }
  });
  
  // Total students
  const totalStudents = await Student.countDocuments({ schoolId, isActive: true });
  
  // Average score (from exam marks)
  const avgScoreResult = await ExamMark.aggregate([
    { $match: { schoolId: schoolId } },
    { $group: {
      _id: null,
      avgPercentage: { $avg: '$percentage' }
    }}
  ]);
  
  const avgScore = avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgPercentage) : 0;
  
  // Upcoming exams
  const upcomingExams = await Exam.find({
    schoolId,
    status: 'upcoming'
  })
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .sort({ examDate: 1 })
    .limit(5);
  
  // Recent results by class
  const recentResults = await ExamMark.aggregate([
    { $match: { schoolId: schoolId } },
    {
      $group: {
        _id: '$classId',
        avgPercentage: { $avg: '$percentage' }
      }
    },
    {
      $lookup: {
        from: 'classes',
        localField: '_id',
        foreignField: '_id',
        as: 'classInfo'
      }
    },
    { $unwind: '$classInfo' },
    {
      $project: {
        className: '$classInfo.name',
        avgPercentage: { $round: ['$avgPercentage', 0] }
      }
    },
    { $sort: { avgPercentage: -1 } },
    { $limit: 5 }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      totalExams,
      activeExams,
      totalStudents,
      avgScore,
      upcomingExams,
      recentResults
    }
  });
});

// @desc    Get exam marks for a specific exam
// @route   GET /api/exams/:id/marks
// @access  Private
exports.getExamMarks = asyncHandler(async (req, res) => {
  const marks = await ExamMark.find({ examId: req.params.id })
    .populate('studentId', 'name rollNumber')
    .populate('subjectId', 'name')
    .sort({ 'studentId.rollNumber': 1 });
  
  res.status(200).json({
    success: true,
    count: marks.length,
    data: marks
  });
});

// @desc    Add or update exam marks
// @route   POST /api/exams/:id/marks
// @access  Private
exports.addExamMarks = asyncHandler(async (req, res) => {
  const { studentId, marksObtained, remarks, isAbsent } = req.body;
  
  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }
  
  // Check if marks already exist
  let examMark = await ExamMark.findOne({
    examId: req.params.id,
    studentId
  });
  
  if (examMark) {
    // Update existing marks
    examMark.marksObtained = marksObtained;
    examMark.remarks = remarks;
    examMark.isAbsent = isAbsent;
    examMark.updatedBy = req.user.id;
    await examMark.save();
  } else {
    // Create new marks entry
    examMark = await ExamMark.create({
      schoolId: exam.schoolId,
      examId: req.params.id,
      studentId,
      classId: exam.classId,
      subjectId: exam.subjectId,
      marksObtained,
      totalMarks: exam.totalMarks,
      remarks,
      isAbsent,
      enteredBy: req.user.id
    });
  }
  
  const populatedMark = await ExamMark.findById(examMark._id)
    .populate('studentId', 'name rollNumber')
    .populate('subjectId', 'name');
  
  res.status(200).json({
    success: true,
    data: populatedMark
  });
});

// @desc    Get all exam marks with filters
// @route   GET /api/exams/marks
// @access  Private
exports.getAllExamMarks = asyncHandler(async (req, res) => {
  const { schoolId, classId, studentId, examId } = req.query;
  
  const filter = {};
  if (schoolId) filter.schoolId = schoolId;
  if (classId) filter.classId = classId;
  if (studentId) filter.studentId = studentId;
  if (examId) filter.examId = examId;
  
  const marks = await ExamMark.find(filter)
    .populate('studentId', 'name rollNumber')
    .populate('examId', 'name examType examDate')
    .populate('subjectId', 'name code')
    .populate('classId', 'name section')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: marks.length,
    data: marks
  });
});

// @desc    Update exam mark
// @route   PUT /api/exams/marks/:id
// @access  Private
exports.updateExamMark = asyncHandler(async (req, res) => {
  let mark = await ExamMark.findById(req.params.id);
  
  if (!mark) {
    return res.status(404).json({
      success: false,
      error: 'Exam mark not found'
    });
  }
  
  req.body.updatedBy = req.user.id;
  
  mark = await ExamMark.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  )
    .populate('studentId', 'name rollNumber')
    .populate('examId', 'name examType')
    .populate('subjectId', 'name');
  
  res.status(200).json({
    success: true,
    data: mark
  });
});

// @desc    Delete exam mark
// @route   DELETE /api/exams/marks/:id
// @access  Private
exports.deleteExamMark = asyncHandler(async (req, res) => {
  const mark = await ExamMark.findById(req.params.id);
  
  if (!mark) {
    return res.status(404).json({
      success: false,
      error: 'Exam mark not found'
    });
  }
  
  await mark.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get exam schedule
// @route   GET /api/exams/schedule
// @access  Private
exports.getExamSchedule = asyncHandler(async (req, res) => {
  const { schoolId, classId, startDate, endDate } = req.query;
  
  const filter = { schoolId };
  if (classId) filter.classId = classId;
  
  if (startDate && endDate) {
    filter.examDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const schedule = await Exam.find(filter)
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .sort({ examDate: 1, examTime: 1 });
  
  res.status(200).json({
    success: true,
    count: schedule.length,
    data: schedule
  });
});

// @desc    Get date sheet (class-wise exam schedule)
// @route   GET /api/exams/date-sheet
// @access  Private
exports.getDateSheet = asyncHandler(async (req, res) => {
  const { schoolId, classId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      error: 'School ID is required'
    });
  }
  
  const filter = { schoolId, status: { $in: ['upcoming', 'ongoing'] } };
  if (classId) filter.classId = classId;
  
  const dateSheet = await Exam.find(filter)
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .sort({ examDate: 1, examTime: 1 });
  
  // Group by class if no specific class is requested
  let groupedDateSheet = {};
  if (!classId) {
    dateSheet.forEach(exam => {
      const className = exam.classId?.name || 'Unknown';
      if (!groupedDateSheet[className]) {
        groupedDateSheet[className] = [];
      }
      groupedDateSheet[className].push(exam);
    });
  } else {
    groupedDateSheet = { [dateSheet[0]?.classId?.name || 'Class']: dateSheet };
  }
  
  res.status(200).json({
    success: true,
    data: groupedDateSheet
  });
});

// @desc    Bulk create exams
// @route   POST /api/exams/bulk
// @access  Private
exports.bulkCreateExams = asyncHandler(async (req, res) => {
  const { exams } = req.body;
  
  if (!Array.isArray(exams) || exams.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Exams array is required'
    });
  }
  
  // Add creator info to all exams
  const examsWithCreator = exams.map(exam => ({
    ...exam,
    createdBy: req.user.id
  }));
  
  const createdExams = await Exam.insertMany(examsWithCreator);
  
  res.status(201).json({
    success: true,
    count: createdExams.length,
    data: createdExams
  });
});

module.exports = exports;

