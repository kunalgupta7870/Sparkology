const Meeting = require('../models/Meeting');
const asyncHandler = require('../middleware/asyncHandler');

// Helper function to update meeting statuses based on time
const updateMeetingStatuses = async (meetings) => {
  const now = new Date();
  const updatePromises = [];

  for (const meeting of meetings) {
    const meetingEndTime = new Date(meeting.meetingTime.getTime() + (meeting.duration || 60) * 60000);
    const meetingStartTime = new Date(meeting.meetingTime);

    // If meeting has ended and status is still 'scheduled', update to 'completed'
    if (now > meetingEndTime && meeting.status === 'scheduled') {
      updatePromises.push(
        Meeting.findByIdAndUpdate(meeting._id, { status: 'completed' }, { new: true })
      );
      meeting.status = 'completed';
    }
    // If meeting is currently ongoing and status is 'scheduled', update to 'ongoing'
    else if (now >= meetingStartTime && now <= meetingEndTime && meeting.status === 'scheduled') {
      updatePromises.push(
        Meeting.findByIdAndUpdate(meeting._id, { status: 'ongoing' }, { new: true })
      );
      meeting.status = 'ongoing';
    }
  }

  // Execute all updates in parallel
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  return meetings;
};

// @desc    Get all meetings for a teacher or school admin
// @route   GET /api/meetings
// @access  Private (Teacher, School Admin)
exports.getMeetings = asyncHandler(async (req, res) => {
  const { classId, subjectId, status, startDate, endDate } = req.query;
  
  const query = {
    schoolId: req.user.school || req.user.schoolId
  };

  // If user is a teacher, only show their meetings
  // If user is school_admin, show all meetings for the school
  if (req.user.role === 'teacher') {
    query.teacherId = req.user._id;
  }

  // Add filters if provided
  if (classId) query.classId = classId;
  if (subjectId) query.subjectId = subjectId;
  if (status) query.status = status;
  
  // Date range filter
  if (startDate || endDate) {
    query.meetingTime = {};
    if (startDate) query.meetingTime.$gte = new Date(startDate);
    if (endDate) query.meetingTime.$lte = new Date(endDate);
  }

  let meetings = await Meeting.find(query)
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .populate('teacherId', 'name email')
    .sort({ meetingTime: -1 });

  // Update statuses based on current time
  meetings = await updateMeetingStatuses(meetings);

  res.status(200).json({
    success: true,
    count: meetings.length,
    data: meetings
  });
});

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private (Teacher, School Admin)
exports.getMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id)
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .populate('teacherId', 'name email');

  if (!meeting) {
    return res.status(404).json({
      success: false,
      error: 'Meeting not found'
    });
  }

  // Check authorization
  const isTeacherOwner = meeting.teacherId._id.toString() === req.user._id.toString();
  const isSchoolAdmin = req.user.role === 'school_admin' && 
    meeting.schoolId.toString() === (req.user.school || req.user.schoolId).toString();
  
  if (!isTeacherOwner && !isSchoolAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this meeting'
    });
  }

  res.status(200).json({
    success: true,
    data: meeting
  });
});

// @desc    Create new meeting
// @route   POST /api/meetings
// @access  Private (Teacher)
exports.createMeeting = asyncHandler(async (req, res) => {
  const { title, url, meetingTime, duration, description, classId, subjectId } = req.body;

  // Validate required fields
  if (!title || !url || !meetingTime || !classId || !subjectId) {
    return res.status(400).json({
      success: false,
      error: 'Please provide title, URL, meeting time, class, and subject'
    });
  }

  // Create meeting
  const meeting = await Meeting.create({
    title,
    url,
    meetingTime,
    duration: duration || 60,
    description,
    classId,
    subjectId,
    teacherId: req.user._id,
    schoolId: req.user.school || req.user.schoolId
  });

  // Populate the meeting before sending response
  const populatedMeeting = await Meeting.findById(meeting._id)
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .populate('teacherId', 'name email');

  res.status(201).json({
    success: true,
    data: populatedMeeting
  });
});

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private (Teacher)
exports.updateMeeting = asyncHandler(async (req, res) => {
  let meeting = await Meeting.findById(req.params.id);

  if (!meeting) {
    return res.status(404).json({
      success: false,
      error: 'Meeting not found'
    });
  }

  // Check if user is the teacher who created the meeting
  if (meeting.teacherId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this meeting'
    });
  }

  // Update meeting
  meeting = await Meeting.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).populate('classId', 'name section')
   .populate('subjectId', 'name')
   .populate('teacherId', 'name email');

  res.status(200).json({
    success: true,
    data: meeting
  });
});

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private (Teacher)
exports.deleteMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);

  if (!meeting) {
    return res.status(404).json({
      success: false,
      error: 'Meeting not found'
    });
  }

  // Check if user is the teacher who created the meeting
  if (meeting.teacherId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to delete this meeting'
    });
  }

  await meeting.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get teacher's classes (for creating meetings)
// @route   GET /api/meetings/teacher/classes
// @access  Private (Teacher)
exports.getTeacherClasses = asyncHandler(async (req, res) => {
  const Schedule = require('../models/Schedule');
  const Class = require('../models/Class');

  // Get unique classes and subjects from teacher's schedule
  const schedules = await Schedule.find({ teacherId: req.user._id })
    .populate('classId')
    .populate('subjectId')
    .select('classId subjectId');

  // Group subjects by class
  const classMap = new Map();
  
  schedules.forEach(schedule => {
    if (schedule.classId && schedule.subjectId) {
      const classId = schedule.classId._id.toString();
      
      if (!classMap.has(classId)) {
        classMap.set(classId, {
          _id: schedule.classId._id,
          name: schedule.classId.name,
          section: schedule.classId.section,
          room: schedule.classId.room,
          subjects: []
        });
      }
      
      // Add subject if not already added
      const classData = classMap.get(classId);
      const subjectExists = classData.subjects.some(
        s => s._id.toString() === schedule.subjectId._id.toString()
      );
      
      if (!subjectExists) {
        classData.subjects.push({
          _id: schedule.subjectId._id,
          name: schedule.subjectId.name,
          code: schedule.subjectId.code
        });
      }
    }
  });

  const classes = Array.from(classMap.values());

  res.status(200).json({
    success: true,
    data: classes
  });
});

// @desc    Get upcoming meetings
// @route   GET /api/meetings/upcoming
// @access  Private (Teacher, School Admin)
exports.getUpcomingMeetings = asyncHandler(async (req, res) => {
  const now = new Date();
  const query = {
    schoolId: req.user.school || req.user.schoolId,
    meetingTime: { $gte: now },
    status: { $in: ['scheduled', 'ongoing'] }
  };
  
  // If user is a teacher, only show their meetings
  if (req.user.role === 'teacher') {
    query.teacherId = req.user._id;
  }
  
  let meetings = await Meeting.find(query)
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .sort({ meetingTime: 1 })
    .limit(10);

  // Update statuses based on current time
  meetings = await updateMeetingStatuses(meetings);

  res.status(200).json({
    success: true,
    count: meetings.length,
    data: meetings
  });
});

// @desc    Get past meetings
// @route   GET /api/meetings/past
// @access  Private (Teacher, School Admin)
exports.getPastMeetings = asyncHandler(async (req, res) => {
  const now = new Date();
  const query = {
    schoolId: req.user.school || req.user.schoolId,
    $or: [
      { meetingTime: { $lt: now } },
      { status: 'completed' }
    ]
  };
  
  // If user is a teacher, only show their meetings
  if (req.user.role === 'teacher') {
    query.teacherId = req.user._id;
  }
  
  let meetings = await Meeting.find(query)
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .sort({ meetingTime: -1 });

  // Update statuses based on current time
  meetings = await updateMeetingStatuses(meetings);

  res.status(200).json({
    success: true,
    count: meetings.length,
    data: meetings
  });
});

// @desc    Get meetings for student (by their class)
// @route   GET /api/meetings/student
// @access  Private (Student)
exports.getStudentMeetings = asyncHandler(async (req, res) => {
  // Get student's class (student authenticates with their own _id)
  const Student = require('../models/Student');
  const student = await Student.findById(req.user._id).populate('classId');
  
  if (!student || !student.classId) {
    return res.status(404).json({
      success: false,
      error: 'Student class not found'
    });
  }

  let meetings = await Meeting.find({
    classId: student.classId._id,
    schoolId: req.user.school || req.user.schoolId
  })
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .populate('teacherId', 'name')
    .sort({ meetingTime: -1 });

  // Update statuses based on current time
  meetings = await updateMeetingStatuses(meetings);

  res.status(200).json({
    success: true,
    count: meetings.length,
    data: meetings
  });
});

// @desc    Get single meeting for student
// @route   GET /api/meetings/student/:id
// @access  Private (Student)
exports.getStudentMeeting = asyncHandler(async (req, res) => {
  const Student = require('../models/Student');
  const student = await Student.findById(req.user._id);
  
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student not found'
    });
  }

  const meeting = await Meeting.findById(req.params.id)
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .populate('teacherId', 'name');

  if (!meeting) {
    return res.status(404).json({
      success: false,
      error: 'Meeting not found'
    });
  }

  // Check if student belongs to the meeting's class
  if (meeting.classId._id.toString() !== student.classId.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this meeting'
    });
  }

  res.status(200).json({
    success: true,
    data: meeting
  });
});

// @desc    Get today's meetings for student
// @route   GET /api/meetings/student/today
// @access  Private (Student)
exports.getStudentTodayMeetings = asyncHandler(async (req, res) => {
  const Student = require('../models/Student');
  const student = await Student.findById(req.user._id);
  
  if (!student) {
    return res.status(404).json({
      success: false,
      error: 'Student not found'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let meetings = await Meeting.find({
    classId: student.classId,
    schoolId: req.user.school || req.user.schoolId,
    meetingTime: {
      $gte: today,
      $lt: tomorrow
    }
  })
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .populate('teacherId', 'name')
    .sort({ meetingTime: 1 });

  // Update statuses based on current time
  meetings = await updateMeetingStatuses(meetings);

  res.status(200).json({
    success: true,
    count: meetings.length,
    data: meetings
  });
});

