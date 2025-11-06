const Student = require('../models/Student');
const User = require('../models/User');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const School = require('../models/School');
const { generateToken } = require('../middleware/auth');
const { validationResult } = require('express-validator');

// @desc    Get all students
// @route   GET /api/students
// @access  Private (School Admin, Teachers for their classes)
const getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 1000, classId, status } = req.query;
    const schoolId = req.user.schoolId;
    const userRole = req.user.role;

    // Build query
    const query = { schoolId };
    if (classId) query.classId = classId;
    if (status) query.status = status;

    // For teachers, get students from all classes they teach
    if (userRole === 'teacher') {
      if (!classId) {
        // Get all classes that this teacher teaches
        const Subject = require('../models/Subject');
        const teacherSubjects = await Subject.find({ 
          teacherId: req.user._id,
          schoolId,
          status: 'active'
        }).distinct('classId');

        if (teacherSubjects.length === 0) {
          return res.status(200).json({
            success: true,
            count: 0,
            total: 0,
            data: []
          });
        }

        // Get students from all these classes
        query.classId = { $in: teacherSubjects };
      }
    }

    const students = await Student.find(query)
      .populate('classId', 'name section')
      .populate('schoolId', 'name code')
      .sort({ classId: 1, rollNumber: 1 }) // Sort by class first, then roll number
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Student.countDocuments(query);

    res.status(200).json({
      success: true,
      count: students.length,
      total,
      data: students
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching students'
    });
  }
};

// @desc    Get student by ID
// @route   GET /api/students/:id
// @access  Private (School Admin, Teacher, Parent)
const getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('classId', 'name section teacherId')
      .populate('schoolId', 'name code address');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if user has access to this student
    if (req.user.role === 'school_admin' && student.schoolId._id.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Fetch parent information linked to this student
    const parents = await Parent.find({
      $or: [
        { studentIds: student._id },
        { studentId: student._id }
      ],
      schoolId: student.schoolId
    }).select('name email phone parentType');

    // Organize parent info by type
    const parentInfo = {};
    parents.forEach(parent => {
      if (parent.parentType === 'father') {
        parentInfo.fatherName = parent.name;
        parentInfo.fatherEmail = parent.email;
        parentInfo.fatherPhone = parent.phone;
      } else if (parent.parentType === 'mother') {
        parentInfo.motherName = parent.name;
        parentInfo.motherEmail = parent.email;
        parentInfo.motherPhone = parent.phone;
      } else if (parent.parentType === 'guardian') {
        parentInfo.guardianName = parent.name;
        parentInfo.guardianEmail = parent.email;
        parentInfo.guardianPhone = parent.phone;
      }
    });

    // Convert student to object and add parent info
    const studentData = student.toObject();
    studentData.parentInfo = parentInfo;

    res.status(200).json({
      success: true,
      data: studentData
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student'
    });
  }
};

// @desc    Create new student with login credentials
// @route   POST /api/students
// @access  Private (School Admin)
const createStudent = async (req, res) => {
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

    const {
      name,
      email,
      password,
      rollNumber,
      admissionNumber,
      dateOfBirth,
      gender,
      classId,
      address,
      phone,
      bloodGroup,
      medicalInfo,
      previousSchool,
      pdfs
    } = req.body;

    const schoolId = req.user.schoolId;

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [
        { email: email.toLowerCase() },
        { rollNumber },
        { admissionNumber }
      ]
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        error: 'Student already exists with this email, roll number, or admission number'
      });
    }

    // Verify class exists and belongs to the school
    if (classId) {
      const classExists = await Class.findOne({ _id: classId, schoolId });
      if (!classExists) {
        return res.status(400).json({
          success: false,
          error: 'Class not found or does not belong to your school'
        });
      }
    }

    // Create student
    console.log('📝 Creating student with classId:', classId);
    const student = await Student.create({
      name,
      email: email.toLowerCase(),
      password,
      rollNumber,
      admissionNumber,
      dateOfBirth,
      gender,
      classId: classId || null,
      schoolId,
      address: address || {},
      phone,
      bloodGroup,
      medicalInfo: medicalInfo || {},
      previousSchool,
      pdfs: pdfs || []
    });
    console.log('✅ Student created with ID:', student._id, 'classId:', student.classId);

    // Create or update parent records if parent info is provided
    const createdParents = [];
    const parentInfo = req.body.parentInfo;
    
    // Helper function to create or link parent
    const createOrLinkParent = async (parentData) => {
      const { email, password, name, phone, parentType } = parentData;
      
      // Check if parent already exists
      const existingParent = await Parent.findOne({ 
        email: email.toLowerCase(),
        schoolId: schoolId
      });
      
      if (existingParent) {
        // Parent exists - add this student to their children list
        console.log(`📝 Found existing ${parentType} parent: ${email}`);
        
        // Add student to studentIds array if not already there
        if (!existingParent.studentIds) {
          existingParent.studentIds = [];
        }
        
        if (!existingParent.studentIds.some(id => id.toString() === student._id.toString())) {
          existingParent.studentIds.push(student._id);
        }
        
        // Keep backward compatibility with studentId
        if (!existingParent.studentId) {
          existingParent.studentId = student._id;
        }
        
        await existingParent.save();
        console.log(`✅ Added student ${student._id} to existing ${parentType} parent, total children: ${existingParent.studentIds.length}`);
        return existingParent;
      } else {
        // Parent doesn't exist - create new parent record
        console.log(`📝 Creating new ${parentType} parent: ${email}`);
        const newParent = await Parent.create({
          name: name || parentType.charAt(0).toUpperCase() + parentType.slice(1),
          email: email.toLowerCase(),
          password: password,
          phone: phone || '',
          parentType: parentType,
          studentId: student._id,
          studentIds: [student._id],
          schoolId: schoolId
        });
        console.log(`✅ Created new ${parentType} parent with student ${student._id}`);
        return newParent;
      }
    };
    
    // Process father
    if (parentInfo?.fatherEmail && parentInfo?.fatherPassword) {
      try {
        const fatherParent = await createOrLinkParent({
          email: parentInfo.fatherEmail,
          password: parentInfo.fatherPassword,
          name: parentInfo.fatherName,
          phone: parentInfo.fatherPhone,
          parentType: 'father'
        });
        createdParents.push(fatherParent);
      } catch (error) {
        console.error('Error processing father parent:', error.message);
        // Continue with other parents even if one fails
      }
    }

    // Process mother
    if (parentInfo?.motherEmail && parentInfo?.motherPassword) {
      try {
        const motherParent = await createOrLinkParent({
          email: parentInfo.motherEmail,
          password: parentInfo.motherPassword,
          name: parentInfo.motherName,
          phone: parentInfo.motherPhone,
          parentType: 'mother'
        });
        createdParents.push(motherParent);
      } catch (error) {
        console.error('Error processing mother parent:', error.message);
        // Continue with other parents even if one fails
      }
    }

    // Process guardian
    if (parentInfo?.guardianEmail && parentInfo?.guardianPassword) {
      try {
        const guardianParent = await createOrLinkParent({
          email: parentInfo.guardianEmail,
          password: parentInfo.guardianPassword,
          name: parentInfo.guardianName,
          phone: parentInfo.guardianPhone,
          parentType: 'guardian'
        });
        createdParents.push(guardianParent);
      } catch (error) {
        console.error('Error processing guardian parent:', error.message);
        // Continue with other parents even if one fails
      }
    }

    // Update school student count
    await School.findByIdAndUpdate(schoolId, { $inc: { students: 1 } });

    // Populate the created student
    await student.populate('classId', 'name section');
    await student.populate('schoolId', 'name code');

    res.status(201).json({
      success: true,
      message: 'Student created successfully with login credentials',
      data: {
        student,
        parentAccounts: createdParents.map(parent => ({
          id: parent._id,
          name: parent.name,
          email: parent.email,
          parentType: parent.parentType,
          studentId: parent.studentId
        }))
      }
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during student creation'
    });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private (School Admin)
const updateStudent = async (req, res) => {
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

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if student belongs to the school
    if (student.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('classId', 'name section').populate('schoolId', 'name code');

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during student update'
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (School Admin)
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if student belongs to the school
    if (student.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Delete associated parent users
    await User.deleteMany({ studentId: student._id });

    // Delete student
    await Student.findByIdAndDelete(req.params.id);

    // Update school student count
    await School.findByIdAndUpdate(student.schoolId, { $inc: { students: -1 } });

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during student deletion'
    });
  }
};

// @desc    Student login
// @route   POST /api/students/login
// @access  Public
const studentLogin = async (req, res) => {
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

    const { email, password } = req.body;

    // Find student and include password
    const student = await Student.findByEmail(email);
    if (!student) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if student is locked
    if (student.isLocked) {
      return res.status(401).json({
        success: false,
        error: 'Account locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Check password
    const isPasswordValid = await student.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await student.incLoginAttempts();
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    if (student.loginAttempts > 0) {
      await student.resetLoginAttempts();
    }

    // Update last login
    student.lastLogin = new Date();
    await student.save();

    // Generate token
    const token = generateToken(student);

    // Populate school and class info
    await student.populate('schoolId', 'name code address');
    await student.populate('classId', 'name section room');
    
    console.log('🔍 Student Login: Student classId after populate:', student.classId);

    const responseData = {
      success: true,
      message: 'Student login successful',
      data: {
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          classId: student.classId,
          schoolId: student.schoolId,
          status: student.status,
          lastLogin: student.lastLogin
        },
        token
      }
    };
    
    console.log('🔍 Student Login: Response data being sent:', {
      studentId: responseData.data.student.id,
      classId: responseData.data.student.classId,
      classIdType: typeof responseData.data.student.classId
    });
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

// @desc    Parent login
// @route   POST /api/students/parents/login
// @access  Public
const parentLogin = async (req, res) => {
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

    const { email, password } = req.body;

    // Find parent record with separate _id
    const parent = await Parent.findOne({
      email: email.toLowerCase()
    }).select('+password');

    if (!parent) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if parent account is locked
    if (parent.isLocked) {
      return res.status(401).json({
        success: false,
        error: 'Account locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Check password
    const isPasswordValid = await parent.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await parent.incLoginAttempts();
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    if (parent.loginAttempts > 0) {
      await parent.resetLoginAttempts();
    }

    // Update last login
    parent.lastLogin = new Date();
    await parent.save();

    // Get student information
    const student = await Student.findById(parent.studentId)
      .populate('classId', 'name section')
      .populate('schoolId', 'name code address');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Associated student not found'
      });
    }

    // Generate token with parent's own _id
    const token = generateToken(parent);

    res.status(200).json({
      success: true,
      message: 'Parent login successful',
      data: {
        parent: {
          id: parent._id, // Parent's own _id
          name: parent.name,
          email: parent.email,
          role: 'parent',
          studentId: parent.studentId, // Link to ward
          parentType: parent.parentType,
          lastLogin: parent.lastLogin
        },
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          classId: student.classId,
          schoolId: student.schoolId,
          status: student.status
        },
        token
      }
    });
  } catch (error) {
    console.error('Parent login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

// @desc    Get class contacts (classmates and teachers)
// @route   GET /api/students/class-contacts
// @access  Private (Student)
const getClassContacts = async (req, res) => {
  try {
    const studentId = req.user._id;
    const schoolId = req.user.schoolId;

    // Get student's class information
    const student = await Student.findById(studentId).populate('classId', 'name section');
    
    if (!student || !student.classId) {
      return res.status(404).json({
        success: false,
        error: 'Student not found or not assigned to any class'
      });
    }

    // Get all classmates (excluding the current student)
    const classmates = await Student.find({
      classId: student.classId._id,
      schoolId: schoolId,
      status: 'active',
      _id: { $ne: studentId }
    }).select('name email rollNumber').sort({ rollNumber: 1 });

    // Get class teacher (if assigned)
    const classInfo = await Class.findById(student.classId._id).populate('teacherId', 'name email role');
    const classTeacher = classInfo.teacherId;

    // Get all teachers who teach subjects to this class
    const Subject = require('../models/Subject');
    const subjects = await Subject.find({
      classId: student.classId._id,
      schoolId: schoolId,
      status: 'active',
      teacherId: { $ne: null }
    }).populate('teacherId', 'name email role');

    console.log(`Found ${subjects.length} subjects for class ${student.classId.name}`);
    console.log(`Class teacher: ${classTeacher ? classTeacher.name : 'None'}`);

    // Get unique teachers and their subjects
    const uniqueTeachers = new Map();
    
    // Add class teacher first (if exists)
    if (classTeacher) {
      uniqueTeachers.set(classTeacher._id.toString(), {
        _id: classTeacher._id,
        name: classTeacher.name,
        email: classTeacher.email,
        role: classTeacher.role,
        subjects: ['Class Teacher'],
        isClassTeacher: true
      });
    }
    
    // Add subject teachers
    subjects.forEach(subject => {
      if (subject.teacherId) {
        const teacherId = subject.teacherId._id.toString();
        if (!uniqueTeachers.has(teacherId)) {
          uniqueTeachers.set(teacherId, {
            _id: subject.teacherId._id,
            name: subject.teacherId.name,
            email: subject.teacherId.email,
            role: subject.teacherId.role,
            subjects: [subject.name],
            isClassTeacher: false
          });
        } else {
          const teacher = uniqueTeachers.get(teacherId);
          if (!teacher.subjects.includes(subject.name)) {
            teacher.subjects.push(subject.name);
          }
        }
      }
    });

    const teachers = Array.from(uniqueTeachers.values());

    console.log(`Found ${classmates.length} classmates and ${teachers.length} teachers`);
    console.log('Teachers:', teachers.map(t => t.name));

    res.status(200).json({
      success: true,
      data: {
        classmates,
        teachers,
        classInfo: {
          name: student.classId.name,
          section: student.classId.section
        }
      }
    });
  } catch (error) {
    console.error('Get class contacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching class contacts'
    });
  }
};

// @desc    Get student statistics
// @route   GET /api/students/stats
// @access  Private (School Admin)
const getStudentStats = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const stats = await Student.aggregate([
      { $match: { schoolId: schoolId } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          activeStudents: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactiveStudents: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          graduatedStudents: {
            $sum: { $cond: [{ $eq: ['$status', 'graduated'] }, 1, 0] }
          }
        }
      }
    ]);

    const classDistribution = await Student.aggregate([
      { $match: { schoolId: schoolId, status: 'active' } },
      {
        $group: {
          _id: '$classId',
          count: { $sum: 1 }
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
      {
        $unwind: '$classInfo'
      },
      {
        $project: {
          className: '$classInfo.name',
          section: '$classInfo.section',
          count: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalStudents: 0,
          activeStudents: 0,
          inactiveStudents: 0,
          graduatedStudents: 0
        },
        classDistribution
      }
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student statistics'
    });
  }
};

// @desc    Assign student to class
// @route   PUT /api/students/:id/assign-class
// @access  Private (School Admin)
const assignStudentToClass = async (req, res) => {
  try {
    const { classId } = req.body;
    const studentId = req.params.id;
    const schoolId = req.user.schoolId;

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if student belongs to the school
    if (student.schoolId.toString() !== schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Verify class exists and belongs to the school
    if (classId) {
      const classExists = await Class.findOne({ _id: classId, schoolId });
      if (!classExists) {
        return res.status(400).json({
          success: false,
          error: 'Class not found or does not belong to your school'
        });
      }
    }

    // Update student's class
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { classId: classId || null },
      { new: true, runValidators: true }
    ).populate('classId', 'name section').populate('schoolId', 'name code');

    res.status(200).json({
      success: true,
      message: 'Student assigned to class successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Assign student to class error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during student assignment'
    });
  }
};

// @desc    Remove student from class
// @route   PUT /api/students/:id/remove-class
// @access  Private (School Admin)
const removeStudentFromClass = async (req, res) => {
  try {
    const studentId = req.params.id;
    const schoolId = req.user.schoolId;

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Check if student belongs to the school
    if (student.schoolId.toString() !== schoolId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Remove student from class
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { classId: null },
      { new: true, runValidators: true }
    ).populate('classId', 'name section').populate('schoolId', 'name code');

    res.status(200).json({
      success: true,
      message: 'Student removed from class successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Remove student from class error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during student removal'
    });
  }
};

// @desc    Get student profile
// @route   GET /api/students/profile
// @access  Private (Student)
const getStudentProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id)
      .populate('classId', 'name section')
      .populate('schoolId', 'name code address');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          admissionNumber: student.admissionNumber,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          classId: student.classId,
          schoolId: student.schoolId,
          address: student.address,
          phone: student.phone,
          bloodGroup: student.bloodGroup,
          medicalInfo: student.medicalInfo,
          status: student.status,
          lastLogin: student.lastLogin,
          createdAt: student.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student profile'
    });
  }
};

// @desc    Get student classes
// @route   GET /api/students/classes
// @access  Private (Student)
const getStudentClasses = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id)
      .populate('classId', 'name section teacherId')
      .populate('schoolId', 'name code');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        class: student.classId,
        school: student.schoolId
      }
    });
  } catch (error) {
    console.error('Get student classes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student classes'
    });
  }
};

// @desc    Get student schedule
// @route   GET /api/students/schedule
// @access  Private (Student)
const getStudentSchedule = async (req, res) => {
  try {
    const { date, week } = req.query;
    const student = await Student.findById(req.user._id);
    
    if (!student || !student.classId) {
      return res.status(404).json({
        success: false,
        error: 'Student not found or not assigned to any class'
      });
    }

    const Schedule = require('../models/Schedule');
    let query = { 
      classId: student.classId,
      schoolId: student.schoolId,
      isActive: true
    };

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    } else if (week) {
      const weekStart = new Date(week);
      const weekEnd = new Date(week);
      weekEnd.setDate(weekEnd.getDate() + 7);
      query.date = { $gte: weekStart, $lt: weekEnd };
    }

    const schedules = await Schedule.find(query)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Get student schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student schedule'
    });
  }
};

// @desc    Get student assignments
// @route   GET /api/students/assignments
// @access  Private (Student)
const getStudentAssignments = async (req, res) => {
  try {
    const { status, subjectId, dueDate } = req.query;
    const student = await Student.findById(req.user._id);
    
    if (!student || !student.classId) {
      return res.status(404).json({
        success: false,
        error: 'Student not found or not assigned to any class'
      });
    }

    const Assignment = require('../models/Assignment');
    let query = { 
      classId: student.classId,
      schoolId: student.schoolId
    };

    if (status) query.status = status;
    if (subjectId) query.subjectId = subjectId;
    if (dueDate) {
      const date = new Date(dueDate);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      query.dueDate = { $gte: date, $lt: nextDay };
    }

    const assignments = await Assignment.find(query)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Get student assignments error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student assignments'
    });
  }
};

// @desc    Get student notes
// @route   GET /api/students/notes
// @access  Private (Student)
const getStudentNotes = async (req, res) => {
  try {
    const { subjectId } = req.query;
    const student = await Student.findById(req.user._id);
    
    if (!student || !student.classId) {
      return res.status(400).json({
        success: false,
        error: 'Student class information not found'
      });
    }

    // Build query for notes in student's class
    const query = {
      classId: student.classId,
      schoolId: student.schoolId,
      isActive: true
    };

    // Filter by subject if provided
    if (subjectId) {
      query.subjectId = subjectId;
    }

    console.log('📝 Backend: Fetching student notes with query:', query);
    console.log('📝 Backend: Student classId:', student.classId);
    console.log('📝 Backend: Student schoolId:', student.schoolId);

    const Note = require('../models/Note');
    const notes = await Note.find(query)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('classId', 'name section')
      .sort({ createdAt: -1 });

    console.log('📝 Backend: Found notes:', notes.length);
    console.log('📝 Backend: Notes data:', notes.map(n => ({ id: n._id, title: n.title, subject: n.subjectId?.name })));

    res.status(200).json({
      success: true,
      data: notes
    });
  } catch (error) {
    console.error('Get student notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student notes'
    });
  }
};

// @desc    Get student attendance
// @route   GET /api/students/attendance
// @access  Private (Student)
const getStudentAttendance = async (req, res) => {
  try {
    const { date, month, year, subjectId } = req.query;
    const student = await Student.findById(req.user._id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const Attendance = require('../models/Attendance');
    let query = { 
      studentId: student._id,
      schoolId: student.schoolId
    };

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    } else if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    if (subjectId) query.subjectId = subjectId;

    const attendance = await Attendance.find(query)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student attendance'
    });
  }
};

// @desc    Get student performance data
// @route   GET /api/students/:id/performance
// @access  Private (Parent, Teacher, School Admin)
const getStudentPerformance = async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // Check if user has access to this student
    if (req.user.role === 'parent') {
      // Get all student IDs (support both old and new schema)
      let studentIds = [];
      if (req.user.studentIds && req.user.studentIds.length > 0) {
        studentIds = req.user.studentIds.map(id => id.toString());
      } else if (req.user.studentId) {
        studentIds = [req.user.studentId.toString()];
      }
      
      // Check if the requested student is one of the parent's children
      if (!studentIds.includes(studentId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only view your own child\'s performance.'
        });
      }
    }

    const student = await Student.findById(studentId)
      .populate('classId', 'name section')
      .populate('schoolId', 'name code');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Get attendance data for the last 30 days
    const Attendance = require('../models/Attendance');
    const attendanceRecords = await Attendance.find({
      studentId: studentId,
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).populate('subjectId', 'name');

    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // Get assignments data
    const Assignment = require('../models/Assignment');
    const assignments = await Assignment.find({
      classId: student.classId._id,
      schoolId: student.schoolId._id
    }).populate('subjectId', 'name').sort({ createdAt: -1 }).limit(10);

    const totalAssignments = assignments.length;
    const completedAssignments = assignments.filter(a => a.status === 'completed').length;
    const completionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    // Calculate overall performance (average of attendance and assignment completion)
    const overallPerformance = Math.round((attendanceRate + completionRate) / 2);

    // Get recent activities (last 10 assignments)
    const recentActivities = assignments.slice(0, 5).map(assignment => ({
      id: assignment._id,
      type: 'assignment',
      title: assignment.title,
      subject: assignment.subjectId?.name || 'Unknown Subject',
      createdAt: assignment.createdAt,
      status: assignment.status,
      dueDate: assignment.dueDate
    }));

    // Get recent attendance (last 5 records)
    const recentAttendance = attendanceRecords.slice(0, 5).map(record => ({
      date: record.date,
      status: record.status,
      subject: record.subjectId?.name || 'Unknown Subject'
    }));

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          classId: student.classId,
          schoolId: student.schoolId
        },
        performance: {
          overallPerformance,
          attendanceRate,
          completionRate,
          totalDays,
          presentDays,
          totalAssignments,
          completedAssignments
        },
        recentActivities,
        recentAttendance
      }
    });
  } catch (error) {
    console.error('Get student performance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student performance'
    });
  }
};

// @desc    Get student's own exam marks
// @route   GET /api/students/exam-marks
// @access  Private (Student)
const getStudentExamMarks = async (req, res) => {
  try {
    const studentId = req.user._id;
    const student = await Student.findById(studentId).populate('classId', 'name section');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const ExamMark = require('../models/ExamMark');
    
    // Get exam marks for this student
    const examMarks = await ExamMark.find({
      studentId: studentId,
      schoolId: student.schoolId
    })
      .populate('examId', 'name examType examDate totalMarks')
      .populate('subjectId', 'name code')
      .sort({ 'examId.examDate': -1 })
      .limit(50); // Limit to recent 50 exams

    // Group marks by subject for easy visualization
    const marksBySubject = {};
    
    examMarks.forEach(mark => {
      if (mark.subjectId && !mark.isAbsent) {
        const subjectName = mark.subjectId.name;
        
        if (!marksBySubject[subjectName]) {
          marksBySubject[subjectName] = {
            subjectId: mark.subjectId._id,
            subjectName: subjectName,
            subjectCode: mark.subjectId.code,
            exams: [],
            avgPercentage: 0,
            totalMarks: 0,
            marksObtained: 0
          };
        }
        
        marksBySubject[subjectName].exams.push({
          examId: mark.examId?._id,
          examName: mark.examId?.name,
          examType: mark.examId?.examType,
          examDate: mark.examId?.examDate,
          marksObtained: mark.marksObtained,
          totalMarks: mark.totalMarks,
          percentage: mark.percentage,
          grade: mark.grade,
          isPassed: mark.isPassed
        });
        
        marksBySubject[subjectName].totalMarks += mark.totalMarks;
        marksBySubject[subjectName].marksObtained += mark.marksObtained;
      }
    });

    // Calculate average percentage for each subject
    Object.keys(marksBySubject).forEach(subjectName => {
      const subject = marksBySubject[subjectName];
      if (subject.totalMarks > 0) {
        subject.avgPercentage = Math.round((subject.marksObtained / subject.totalMarks) * 100);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        studentId: student._id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        class: student.classId?.name,
        section: student.classId?.section,
        totalExams: examMarks.length,
        subjects: Object.values(marksBySubject),
        allMarks: examMarks
      }
    });
  } catch (error) {
    console.error('Get student exam marks error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching exam marks'
    });
  }
};

// @desc    Get student performance report with exam marks
// @route   GET /api/students/performance-report
// @access  Private (School Admin, Teacher)
const getStudentPerformanceReport = async (req, res) => {
  try {
    const { schoolId, classId } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      });
    }

    console.log('Fetching performance report for:', { schoolId, classId });

    // Build filter
    const filter = { schoolId, isActive: true };
    if (classId && classId !== '') {
      filter.classId = classId;
    }

    // Get all students based on filter
    const students = await Student.find(filter)
      .populate('classId', 'name section')
      .select('name rollNumber classId');

    // Get all exam marks for these students
    const ExamMark = require('../models/ExamMark');
    const studentIds = students.map(s => s._id);

    const examMarkFilter = {
      schoolId,
      studentId: { $in: studentIds }
    };
    
    // If classId is specified, also filter exam marks by class
    if (classId) {
      examMarkFilter.classId = classId;
    }

    const examMarks = await ExamMark.find(examMarkFilter)
      .populate('examId', 'name examType examDate totalMarks')
      .populate('subjectId', 'name')
      .sort({ createdAt: -1 });

    console.log(`Found ${students.length} students and ${examMarks.length} exam marks`);

    // Calculate performance metrics for each student
    const performanceData = students.map(student => {
      const studentMarks = examMarks.filter(
        mark => mark.studentId.toString() === student._id.toString()
      );

      // Calculate average percentage
      const validMarks = studentMarks.filter(m => !m.isAbsent);
      const avgPercentage = validMarks.length > 0
        ? Math.round(validMarks.reduce((sum, m) => sum + m.percentage, 0) / validMarks.length)
        : 0;

      // Calculate average grade
      let avgGrade = 'N/A';
      if (avgPercentage >= 90) avgGrade = 'A+';
      else if (avgPercentage >= 80) avgGrade = 'A';
      else if (avgPercentage >= 70) avgGrade = 'B+';
      else if (avgPercentage >= 60) avgGrade = 'B';
      else if (avgPercentage >= 50) avgGrade = 'C';
      else if (avgPercentage >= 40) avgGrade = 'D';
      else if (avgPercentage >= 33) avgGrade = 'E';
      else if (avgPercentage > 0) avgGrade = 'F';

      // Get exam details with marks
      const exams = studentMarks.map(mark => ({
        examId: mark.examId?._id,
        examName: mark.examId?.name,
        examType: mark.examId?.examType,
        examDate: mark.examId?.examDate,
        subject: mark.subjectId?.name,
        marksObtained: mark.marksObtained,
        totalMarks: mark.totalMarks,
        percentage: Math.round(mark.percentage),
        grade: mark.grade,
        isAbsent: mark.isAbsent,
        isPassed: mark.isPassed
      }));

      return {
        studentId: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        class: student.classId?.name,
        section: student.classId?.section,
        avgPercentage,
        avgGrade,
        totalExams: studentMarks.length,
        examsAppeared: validMarks.length,
        exams
      };
    });

    // Sort by average percentage descending
    performanceData.sort((a, b) => b.avgPercentage - a.avgPercentage);

    // Get grade distribution
    const gradeDistribution = {
      'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0, 'F': 0, 'N/A': 0
    };
    performanceData.forEach(data => {
      if (gradeDistribution[data.avgGrade] !== undefined) {
        gradeDistribution[data.avgGrade]++;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        students: performanceData,
        summary: {
          totalStudents: students.length,
          avgClassPercentage: performanceData.length > 0
            ? Math.round(performanceData.reduce((sum, s) => sum + s.avgPercentage, 0) / performanceData.length)
            : 0,
          gradeDistribution
        }
      }
    });
  } catch (error) {
    console.error('Get student performance report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student performance report'
    });
  }
};

module.exports = {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  studentLogin,
  parentLogin,
  getClassContacts,
  getStudentStats,
  assignStudentToClass,
  removeStudentFromClass,
  getStudentProfile,
  getStudentClasses,
  getStudentSchedule,
  getStudentAssignments,
  getStudentNotes,
  getStudentAttendance,
  getStudentPerformance,
  getStudentPerformanceReport,
  getStudentExamMarks
};
