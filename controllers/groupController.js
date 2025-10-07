const Group = require('../models/Group');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Create new group
// @route   POST /api/groups
// @access  Private (Teacher)
const createGroup = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, description, type, classId, subjectId, studentIds } = req.body;
    const schoolId = req.user.schoolId;
    const createdBy = req.user._id;

    // Check if group name already exists in the school
    const existingGroup = await Group.findOne({ 
      name, 
      schoolId, 
      isActive: true 
    });
    
    if (existingGroup) {
      return res.status(400).json({
        success: false,
        error: 'A group with this name already exists in your school'
      });
    }

    // Create group
    const group = await Group.create({
      name,
      description,
      schoolId,
      createdBy,
      type,
      classId: classId || null,
      subjectId: subjectId || null,
      settings: {
        allowStudentMessages: true,
        allowFileSharing: true,
        notificationEnabled: true
      }
    });

    // Add creator as admin
    await group.addMember(createdBy, 'admin');

    // Add students if provided
    if (studentIds && studentIds.length > 0) {
      for (const studentId of studentIds) {
        // Verify student belongs to the school
        const student = await Student.findOne({ 
          _id: studentId, 
          schoolId 
        });
        
        if (student) {
          await group.addStudent(studentId);
        }
      }
    }

    // If type is class-based, add all students from that class and all teachers who teach that class
    if (type === 'class' && classId) {
      // Add all students from the class
      const students = await Student.find({ 
        classId, 
        schoolId, 
        status: 'active' 
      });
      
      for (const student of students) {
        await group.addStudent(student._id);
      }

      // Add all teachers who teach subjects to this class
      const subjects = await Subject.find({ 
        classId, 
        schoolId, 
        status: 'active',
        teacherId: { $ne: null }
      }).populate('teacherId', 'name email role');

      // Get unique teachers (in case a teacher teaches multiple subjects)
      const uniqueTeachers = new Map();
      subjects.forEach(subject => {
        if (subject.teacherId && !uniqueTeachers.has(subject.teacherId._id.toString())) {
          uniqueTeachers.set(subject.teacherId._id.toString(), subject.teacherId);
        }
      });

      // Add each unique teacher to the group
      for (const teacher of uniqueTeachers.values()) {
        await group.addMember(teacher._id, 'member');
      }

      console.log(`Added ${students.length} students and ${uniqueTeachers.size} teachers to class group`);
    }

    // Populate the created group
    await group.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'members.user', select: 'name email role' },
      { path: 'students.student', select: 'name rollNumber' },
      { path: 'classId', select: 'name section' },
      { path: 'subjectId', select: 'name code' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: group
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during group creation'
    });
  }
};

// @desc    Get all groups for a school
// @route   GET /api/groups
// @access  Private (Teacher, School Admin)
const getGroups = async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const schoolId = req.user.schoolId;
    const userId = req.user._id;

    // Build query - exclude individual chats from main groups list
    const query = { schoolId, isActive: true, type: { $ne: 'individual_chat' } };
    if (type) query.type = type;

    // For teachers, show groups they created, are members of, or teach subjects to classes in the group
    if (req.user.role === 'teacher') {
      query.$or = [
        { createdBy: userId },
        { 'members.user': userId }
      ];
    }

    // For students, show groups they are members of
    if (req.user.role === 'student') {
      query['students.student'] = userId;
    }

    const groups = await Group.find(query)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email role')
      .populate('students.student', 'name rollNumber')
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Group.countDocuments(query);

    res.status(200).json({
      success: true,
      count: groups.length,
      total,
      data: groups
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching groups'
    });
  }
};

// @desc    Get group by ID
// @route   GET /api/groups/:id
// @access  Private (Group Members)
const getGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ 
      _id: req.params.id, 
      schoolId: req.user.schoolId,
      isActive: true 
    })
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email role')
      .populate('students.student', 'name rollNumber')
      .populate('classId', 'name section')
      .populate('subjectId', 'name code');

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user has access to this group
    const hasAccess = req.user.role === 'school_admin' || 
                     group.isMember(req.user._id) || 
                     group.isStudentMember(req.user._id) ||
                     group.createdBy._id.toString() === req.user._id.toString();

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching group'
    });
  }
};

// @desc    Update group
// @route   PUT /api/groups/:id
// @access  Private (Group Admin)
const updateGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ 
      _id: req.params.id, 
      schoolId: req.user.schoolId,
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is admin or creator
    const isAdmin = group.isAdmin(req.user._id) || 
                   group.createdBy.toString() === req.user._id.toString();

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only group admins can update the group'
      });
    }

    const { name, description, settings } = req.body;

    // Update fields
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (settings) group.settings = { ...group.settings, ...settings };

    await group.save();

    // Populate the updated group
    await group.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'members.user', select: 'name email role' },
      { path: 'students.student', select: 'name rollNumber' },
      { path: 'classId', select: 'name section' },
      { path: 'subjectId', select: 'name code' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      data: group
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during group update'
    });
  }
};

// @desc    Add members to group
// @route   POST /api/groups/:id/members
// @access  Private (Group Admin)
const addMembers = async (req, res) => {
  try {
    const { userIds, studentIds } = req.body;
    const group = await Group.findOne({ 
      _id: req.params.id, 
      schoolId: req.user.schoolId,
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is admin or creator
    const isAdmin = group.isAdmin(req.user._id) || 
                   group.createdBy.toString() === req.user._id.toString();

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only group admins can add members'
      });
    }

    // Add users
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        const user = await User.findOne({ 
          _id: userId, 
          schoolId: req.user.schoolId 
        });
        
        if (user) {
          await group.addMember(userId, 'member');
        }
      }
    }

    // Add students
    if (studentIds && studentIds.length > 0) {
      for (const studentId of studentIds) {
        const student = await Student.findOne({ 
          _id: studentId, 
          schoolId: req.user.schoolId 
        });
        
        if (student) {
          await group.addStudent(studentId);
        }
      }
    }

    // Populate the updated group
    await group.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'members.user', select: 'name email role' },
      { path: 'students.student', select: 'name rollNumber' },
      { path: 'classId', select: 'name section' },
      { path: 'subjectId', select: 'name code' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Members added successfully',
      data: group
    });
  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding members'
    });
  }
};

// @desc    Remove members from group
// @route   DELETE /api/groups/:id/members
// @access  Private (Group Admin)
const removeMembers = async (req, res) => {
  try {
    const { userIds, studentIds } = req.body;
    const group = await Group.findOne({ 
      _id: req.params.id, 
      schoolId: req.user.schoolId,
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is admin or creator
    const isAdmin = group.isAdmin(req.user._id) || 
                   group.createdBy.toString() === req.user._id.toString();

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only group admins can remove members'
      });
    }

    // Remove users
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        await group.removeMember(userId);
      }
    }

    // Remove students
    if (studentIds && studentIds.length > 0) {
      for (const studentId of studentIds) {
        await group.removeStudent(studentId);
      }
    }

    // Populate the updated group
    await group.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'members.user', select: 'name email role' },
      { path: 'students.student', select: 'name rollNumber' },
      { path: 'classId', select: 'name section' },
      { path: 'subjectId', select: 'name code' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Members removed successfully',
      data: group
    });
  } catch (error) {
    console.error('Remove members error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while removing members'
    });
  }
};

// @desc    Delete group
// @route   DELETE /api/groups/:id
// @access  Private (Group Creator, School Admin)
const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ 
      _id: req.params.id, 
      schoolId: req.user.schoolId,
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is creator or school admin
    const canDelete = req.user.role === 'school_admin' || 
                     group.createdBy.toString() === req.user._id.toString();

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: 'Only group creator or school admin can delete the group'
      });
    }

    // Soft delete
    group.isActive = false;
    await group.save();

    res.status(200).json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during group deletion'
    });
  }
};

// @desc    Get available students for group creation
// @route   GET /api/groups/available-students
// @access  Private (Teacher)
const getAvailableStudents = async (req, res) => {
  try {
    const { classId } = req.query;
    const schoolId = req.user.schoolId;

    let query = { schoolId, status: 'active' };
    if (classId) query.classId = classId;

    const students = await Student.find(query)
      .populate('classId', 'name section')
      .select('name rollNumber classId')
      .sort({ rollNumber: 1 });

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    console.error('Get available students error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching students'
    });
  }
};

// @desc    Get student's groups
// @route   GET /api/groups/student
// @access  Private (Student)
const getStudentGroups = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const studentId = req.user._id;

    const groups = await Group.find({
      schoolId,
      isActive: true,
      'students.student': studentId
    })
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email role')
      .populate('students.student', 'name rollNumber')
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: groups.length,
      data: groups
    });
  } catch (error) {
    console.error('Get student groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student groups'
    });
  }
};

// @desc    Create or find individual chat group between student and teacher
// @route   POST /api/groups/individual-chat
// @access  Private (Student, Teacher)
const createOrFindIndividualChat = async (req, res) => {
  try {
    const { contactId, contactType } = req.body;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;
    const userRole = req.user.role;

    // Validate input
    if (!contactId || !contactType) {
      return res.status(400).json({
        success: false,
        error: 'Contact ID and type are required'
      });
    }

    // Determine the other participant
    let otherParticipantId, otherParticipantType;
    
    if (userRole === 'student') {
      // Student is messaging a teacher
      if (contactType !== 'teacher') {
        return res.status(400).json({
          success: false,
          error: 'Students can only message teachers'
        });
      }
      otherParticipantId = contactId;
      otherParticipantType = 'User'; // Teacher is a User
    } else if (userRole === 'parent') {
      // Parent messaging is no longer supported
      return res.status(403).json({
        success: false,
        error: 'Parent messaging is not available'
      });
    } else if (userRole === 'teacher') {
      // Teacher can only message students
      if (contactType !== 'student') {
        return res.status(400).json({
          success: false,
          error: 'Teachers can only message students'
        });
      }
      otherParticipantId = contactId;
      otherParticipantType = 'Student';
    } else {
      return res.status(403).json({
        success: false,
        error: 'Only students and teachers can create individual chats'
      });
    }

    // Check if individual chat group already exists
    const existingGroup = await Group.findOne({
      schoolId,
      type: 'individual_chat',
      isActive: true,
      $or: [
        // Student + Teacher combination
        {
          'students.student': userRole === 'student' ? userId : otherParticipantId,
          'members.user': userRole === 'teacher' ? userId : otherParticipantId
        },
        // Teacher + Student combination (reverse)
        {
          'students.student': userRole === 'teacher' ? otherParticipantId : userId,
          'members.user': userRole === 'student' ? otherParticipantId : userId
        },
        // Parent + Teacher combination
        {
          'students.student': userRole === 'parent' ? userId : otherParticipantId,
          'members.user': userRole === 'teacher' ? userId : otherParticipantId
        },
        // Teacher + Parent combination (reverse)
        {
          'students.student': userRole === 'teacher' ? otherParticipantId : userId,
          'members.user': userRole === 'parent' ? otherParticipantId : userId
        }
      ]
    });

    if (existingGroup) {
      // Return existing group
      await existingGroup.populate('students.student', 'name email');
      await existingGroup.populate('members.user', 'name email');
      
      return res.status(200).json({
        success: true,
        message: 'Individual chat group found',
        data: existingGroup
      });
    }

    // Get participant names for group name
    let participant1Name, participant2Name;
    
    if (userRole === 'student') {
      const student = await Student.findById(userId).select('name');
      const teacher = await User.findById(otherParticipantId).select('name');
      participant1Name = student?.name || 'Student';
      participant2Name = teacher?.name || 'Teacher';
    } else if (userRole === 'parent') {
      const student = await Student.findById(userId).select('name parentInfo');
      const teacher = await User.findById(otherParticipantId).select('name');
      // Use parent name from student record
      const parentName = student?.parentInfo?.fatherName || student?.parentInfo?.motherName || student?.parentInfo?.guardianName || 'Parent';
      participant1Name = parentName;
      participant2Name = teacher?.name || 'Teacher';
    } else {
      // Teacher role
      const student = await Student.findById(otherParticipantId).select('name parentInfo');
      const teacher = await User.findById(userId).select('name');
      // Check if it's a parent or student based on contactType
      if (contactType === 'parent') {
        const parentName = student?.parentInfo?.fatherName || student?.parentInfo?.motherName || student?.parentInfo?.guardianName || 'Parent';
        participant1Name = parentName;
      } else {
        participant1Name = student?.name || 'Student';
      }
      participant2Name = teacher?.name || 'Teacher';
    }

    // Create new individual chat group
    const groupData = {
      name: `${participant1Name} & ${participant2Name}`,
      description: `Individual chat between ${participant1Name} and ${participant2Name}`,
      schoolId,
      createdBy: userId,
      type: 'individual_chat',
      settings: {
        allowStudentMessages: true,
        allowFileSharing: true,
        allowReactions: true
      },
      isActive: true
    };

    // Add members based on user role
    if (userRole === 'student' || userRole === 'parent') {
      groupData.students = [{ student: userId }];
      groupData.members = [{ user: otherParticipantId, role: 'member' }];
    } else {
      // Teacher role
      groupData.students = [{ student: otherParticipantId }];
      groupData.members = [{ user: userId, role: 'member' }];
    }

    const group = await Group.create(groupData);

    // Populate the created group
    await group.populate('students.student', 'name email');
    await group.populate('members.user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Individual chat group created successfully',
      data: group
    });

  } catch (error) {
    console.error('Create individual chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating individual chat'
    });
  }
};

// @desc    Get individual chat groups for a user
// @route   GET /api/groups/individual-chats
// @access  Private (Student, Teacher)
const getIndividualChats = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const schoolId = req.user.schoolId;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Build query for individual chats
    const query = { 
      schoolId, 
      isActive: true, 
      type: 'individual_chat' 
    };

    // For teachers, show individual chats where they are members
    if (userRole === 'teacher') {
      query['members.user'] = userId;
    }

    // For students, show individual chats where they are students
    if (userRole === 'student') {
      query['students.student'] = userId;
    }

    const groups = await Group.find(query)
      .populate('members.user', 'name email role')
      .populate('students.student', 'name rollNumber')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Group.countDocuments(query);

    res.status(200).json({
      success: true,
      count: groups.length,
      total,
      data: groups
    });
  } catch (error) {
    console.error('Get individual chats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching individual chats'
    });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  addMembers,
  removeMembers,
  deleteGroup,
  getAvailableStudents,
  getStudentGroups,
  createOrFindIndividualChat,
  getIndividualChats
};
