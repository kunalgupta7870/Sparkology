const Student = require('../models/Student');
const User = require('../models/User');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const School = require('../models/School');
const { generateToken } = require('../middleware/auth');
const { validationResult } = require('express-validator');

// Helper function to get file extension from MIME type
const getFileExtension = (mimeType) => {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };
  return mimeMap[mimeType] || 'jpg';
};

// @desc    Get all students
// @route   GET /api/students
// @access  Private (School Admin, Teachers for their classes)
const getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 1000, classId, status, schoolId: querySchoolId } = req.query;
    const userRole = req.user.role;
    
    // For admin users, allow querying by schoolId parameter
    // For school admins, use their assigned schoolId
    let schoolId;
    if (userRole === 'admin') {
      if (querySchoolId) {
        schoolId = querySchoolId;
      } else {
        // Admin must provide schoolId
        return res.status(400).json({
          success: false,
          error: 'School ID is required for admin users'
        });
      }
    } else {
      schoolId = req.user.schoolId;
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID not found for user'
        });
      }
    }

    // Build query - ensure schoolId is converted to ObjectId if it's a string
    const mongoose = require('mongoose');
    let finalSchoolId = schoolId;
    // Convert string to ObjectId if it's a valid ObjectId string
    if (typeof schoolId === 'string' && mongoose.Types.ObjectId.isValid(schoolId)) {
      finalSchoolId = new mongoose.Types.ObjectId(schoolId);
    }
    
    const query = { schoolId: finalSchoolId };
    if (classId) {
      let queryClassId = classId;
      if (typeof classId === 'string' && mongoose.Types.ObjectId.isValid(classId)) {
        queryClassId = new mongoose.Types.ObjectId(classId);
      }
      query.classId = queryClassId;
    }
    if (status) query.status = status;
    
    console.log('🔍 Fetching students with query:', {
      schoolId: query.schoolId.toString(),
      classId: query.classId ? query.classId.toString() : undefined,
      status: query.status
    });
    console.log('👤 User role:', userRole);
    console.log('🏫 School ID (original):', schoolId);
    console.log('🏫 School ID (converted):', finalSchoolId.toString());

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
      .populate('houseId', 'name color')
      .populate('schoolId', 'name code')
      .sort({ classId: 1, rollNumber: 1 }) // Sort by class first, then roll number
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log(`✅ Found ${students.length} students for school ${schoolId}`);
    
    const total = await Student.countDocuments(query);
    console.log(`📊 Total students count: ${total}`);

    // For admin users, also fetch parent information for each student
    let studentsWithParents = students;
    if (userRole === 'admin') {
      const Parent = require('../models/Parent');
      studentsWithParents = await Promise.all(students.map(async (student) => {
        const studentObj = student.toObject();
        
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
        
        studentObj.parentInfo = parentInfo;
        return studentObj;
      }));
    }

    res.status(200).json({
      success: true,
      count: students.length,
      total,
      data: studentsWithParents
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
      .populate('houseId', 'name color')
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
    console.log('📥 Received student enrollment request');
    console.log('📋 Request body:', {
      studentName: req.body.studentName,
      email: req.body.email,
      class: req.body.class,
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      hasParentData: !!(req.body.parentDetails?.email || req.body.parentDetails?.password)
    });
    // Debug: Check what files were received
    console.log('📁 Files received:', {
      hasFiles: !!req.files,
      fileKeys: req.files ? Object.keys(req.files) : [],
      avatarFile: req.files?.avatar ? `Present (${Array.isArray(req.files.avatar) ? req.files.avatar.length : 'not array'})` : 'Missing',
      photoFile: req.files?.photo ? `Present (${Array.isArray(req.files.photo) ? req.files.photo.length : 'not array'})` : 'Missing',
      documentsCount: req.files?.documents ? (Array.isArray(req.files.documents) ? req.files.documents.length : 0) : 0
    });
    
    // Check for avatar in different possible formats (for logging only)
    const avatarFileForLog = req.files?.avatar?.[0] || req.files?.avatar || req.files?.photo?.[0] || req.files?.photo;
    if (avatarFileForLog) {
      const fileToLog = Array.isArray(avatarFileForLog) ? avatarFileForLog[0] : avatarFileForLog;
      console.log('📸 File found - details:', {
        fieldname: fileToLog.fieldname,
        originalname: fileToLog.originalname,
        mimetype: fileToLog.mimetype,
        size: fileToLog.size,
        hasBuffer: !!fileToLog.buffer,
        bufferLength: fileToLog.buffer?.length || 0
      });
    } else {
      console.log('❌ No avatar/photo file found in req.files');
      if (req.files) {
        console.log('Available file fields:', Object.keys(req.files));
      }
    }

    // Map new field names to old field names for backward compatibility
    const {
      studentName,
      email,
      password,
      rollNumber,
      admissionNumber,
      dateOfBirth,
      gender,
      class: classFromPayload,
      address,
      phone,
      bloodGroup,
      medicalInfo,
      medicalDetails,
      previousSchool,
      pdfs,
      documents,
      parentDetails,
      parentRelation,
      parentName,
      parentPhone,
      parentEmail,
      parentPassword,
      allergies,
      medicalConditions,
      emergencyContact,
      emergencyContactPhone,
      previousSchoolName,
      previousSchoolBoard,
      previousSchoolPercentage,
      leavingReason,
      admissionDate,
      isDormitory,
      roomNumber,
      houseId
    } = req.body;
    
    // Handle dormitory fields - they are optional
    // Convert string 'true'/'false' to boolean if needed
    let finalIsDormitory = false;
    if (isDormitory !== undefined && isDormitory !== null) {
      if (typeof isDormitory === 'string') {
        finalIsDormitory = isDormitory.toLowerCase() === 'true';
      } else {
        finalIsDormitory = Boolean(isDormitory);
      }
    }
    
    // Only set roomNumber if student is in dormitory
    let finalRoomNumber = null;
    if (finalIsDormitory && roomNumber) {
      finalRoomNumber = roomNumber.trim() || null;
    }

    // Validate required fields
    const errors = [];
    if (!studentName || studentName.trim() === '') errors.push('Student name is required');
    if (!email || email.trim() === '') errors.push('Email is required');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters long');
    if (!dateOfBirth) errors.push('Date of birth is required');
    if (!gender) errors.push('Gender is required');
    if (gender && !['male', 'female', 'other'].includes(gender)) errors.push('Gender must be male, female, or other');

    if (errors.length > 0) {
      console.log('❌ Validation errors:', errors);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.map(msg => ({ msg }))
      });
    }

    const schoolId = req.user.schoolId;

    // Check if email already exists globally (across all schools)
    const existingEmail = await Student.findOne({
      email: email.toLowerCase()
    });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'A student with this email already exists in the system'
      });
    }

    // Check if phone already exists globally (if provided)
    if (phone) {
      const existingPhone = await Student.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: 'A student with this phone number already exists in the system'
        });
      }
    }

    // Generate or use provided admission number
    let finalAdmissionNumber = admissionNumber;
    if (!finalAdmissionNumber || finalAdmissionNumber.trim() === '') {
      // Auto-generate admission number
      const latestStudent = await Student.findOne({ schoolId }).sort({ _id: -1 });
      const lastAdmissionNum = latestStudent?.admissionNumber || '0';
      const numPart = parseInt(lastAdmissionNum.replace(/\D/g, '')) || 0;
      finalAdmissionNumber = `ADM${String(numPart + 1).padStart(4, '0')}`;
    }

    // Check if roll number already exists within the same school (if provided)
    if (rollNumber && rollNumber.trim() !== '') {
      const existingRollNumber = await Student.findOne({
        schoolId: schoolId,
        rollNumber: rollNumber
      });

      if (existingRollNumber) {
        return res.status(400).json({
          success: false,
          error: 'A student with this roll number already exists in your school'
        });
      }
    }

    // Check if admission number already exists within the same school
    const existingAdmissionNumber = await Student.findOne({
      schoolId: schoolId,
      admissionNumber: finalAdmissionNumber
    });

    if (existingAdmissionNumber) {
      return res.status(400).json({
        success: false,
        error: 'A student with this admission number already exists in your school'
      });
    }

    // Verify class exists and belongs to the school (use either classId or class field)
    const finalClassId = classFromPayload;
    if (finalClassId) {
      const classExists = await Class.findOne({ _id: finalClassId, schoolId });
      if (!classExists) {
        return res.status(400).json({
          success: false,
          error: 'Class not found or does not belong to your school'
        });
      }
    }

    // Create student
    console.log('📝 Creating student with classId:', finalClassId);
    
    // Build medicalInfo from individual fields or medicalDetails object
    let finalMedicalInfo = medicalInfo || medicalDetails || {};
    if (!medicalInfo && !medicalDetails) {
      // Build from individual fields if separate fields are provided
      finalMedicalInfo = {};
      if (bloodGroup) finalMedicalInfo.bloodGroup = bloodGroup;
      if (allergies) finalMedicalInfo.allergies = Array.isArray(allergies) ? allergies : [allergies];
      if (medicalConditions) finalMedicalInfo.conditions = Array.isArray(medicalConditions) ? medicalConditions : [medicalConditions];
      if (emergencyContact) finalMedicalInfo.emergencyContact = emergencyContact;
      if (emergencyContactPhone) finalMedicalInfo.emergencyContactPhone = emergencyContactPhone;
    }
    
    // Verify house exists if provided
    if (houseId) {
      const House = require('../models/House');
      const houseExists = await House.findOne({ _id: houseId, schoolId });
      if (!houseExists) {
        return res.status(400).json({
          success: false,
          error: 'House not found or does not belong to your school'
        });
      }
    }

    // Parse address - handle both string (from enrollment form) and object formats
    let parsedAddress = {};
    if (address) {
      if (typeof address === 'string') {
        // If address is a string (from textarea), store it in street field
        parsedAddress = {
          street: address.trim(),
          city: '',
          state: '',
          zipCode: '',
          country: 'India'
        };
        console.log('📍 Address parsed from string:', parsedAddress);
      } else if (typeof address === 'object') {
        // If address is already an object, use it as is
        parsedAddress = {
          street: address.street || '',
          city: address.city || '',
          state: address.state || '',
          zipCode: address.zipCode || '',
          country: address.country || 'India'
        };
        console.log('📍 Address parsed from object:', parsedAddress);
      }
    } else {
      console.log('⚠️ No address provided');
    }

    // Process uploaded documents and save to local storage
    let pdfUrls = pdfs || []; // Use existing pdfs if provided as URLs
    
    if (req.files?.documents && req.files.documents.length > 0) {
      console.log(`📄 Processing ${req.files.documents.length} document(s) for upload`);
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '../uploads/documents');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('📁 Created uploads/documents directory');
      }
      
      // Process each document file
      const documentPromises = req.files.documents.map(async (docFile, index) => {
        try {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + index;
          const ext = path.extname(docFile.originalname || '');
          const baseName = path.basename(docFile.originalname || `document-${index}`, ext);
          const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.-]/g, '_');
          const finalName = sanitizedBaseName + (ext || '.pdf');
          const filename = `student-${uniqueSuffix}-${finalName}`;
          const filepath = path.join(uploadsDir, filename);
          
          // Save file to disk
          fs.writeFileSync(filepath, docFile.buffer);
          const fileUrl = `/uploads/documents/${filename}`;
          
          console.log(`✅ Document ${index + 1} saved: ${filename} (${docFile.size} bytes)`);
          return fileUrl;
        } catch (error) {
          console.error(`❌ Error saving document ${index + 1}:`, error);
          return null;
        }
      });
      
      const savedDocUrls = await Promise.all(documentPromises);
      // Filter out null values (failed uploads) and add to pdfUrls
      const validDocUrls = savedDocUrls.filter(url => url !== null);
      pdfUrls = [...pdfUrls, ...validDocUrls];
      
      console.log(`✅ Total PDFs/Documents to save: ${pdfUrls.length}`);
    } else {
      console.log('📄 No documents uploaded');
    }

    // Create student first to get the ID, then upload avatar
    const student = await Student.create({
      name: studentName,
      email: email.toLowerCase(),
      password,
      ...(rollNumber && { rollNumber }), // Only set if provided
      admissionNumber: finalAdmissionNumber,
      dateOfBirth,
      gender,
      classId: finalClassId || null,
      houseId: houseId || null,
      isDormitory: finalIsDormitory,
      roomNumber: finalRoomNumber,
      schoolId,
      address: parsedAddress,
      phone,
      bloodGroup,
      avatar: null, // Will be updated after Cloudinary upload
      medicalInfo: finalMedicalInfo,
      previousSchool: previousSchool || {
        name: previousSchoolName || '',
        board: previousSchoolBoard || '',
        percentage: previousSchoolPercentage || '',
        leavingReason: leavingReason || ''
      },
      pdfs: pdfUrls, // Save all PDF URLs (from uploads and existing)
      admissionDate: admissionDate || new Date()
    });
    
    console.log(`✅ Student created with ${pdfUrls.length} PDF(s)/document(s)`);
    console.log('✅ Student created with ID:', student._id, 'classId:', student.classId, 'houseId:', student.houseId, 'isDormitory:', student.isDormitory);

    // Handle avatar upload to Cloudinary (after student creation to use actual student ID)
    // Check both 'avatar' and 'photo' field names for compatibility
    // Handle both array and direct file formats
    let avatarFile = null;
    
    if (req.files?.avatar) {
      avatarFile = Array.isArray(req.files.avatar) ? req.files.avatar[0] : req.files.avatar;
    } else if (req.files?.photo) {
      avatarFile = Array.isArray(req.files.photo) ? req.files.photo[0] : req.files.photo;
    }
    
    console.log('🔍 Checking for avatar file:', {
      hasAvatarField: !!req.files?.avatar,
      hasPhotoField: !!req.files?.photo,
      avatarFileFound: !!avatarFile,
      avatarFileType: avatarFile ? typeof avatarFile : 'null'
    });
    
    if (avatarFile && avatarFile.buffer) {
      try {
        console.log(`📸 Processing avatar upload - Size: ${avatarFile.size}, Type: ${avatarFile.mimetype}, Buffer size: ${avatarFile.buffer.length}`);
        
        if (!avatarFile.buffer || avatarFile.buffer.length === 0) {
          throw new Error('Avatar file buffer is empty');
        }
        
        // Import uploadStudentAvatar function - ensure it's available
        const cloudinaryUtils = require('../utils/cloudinary');
        const uploadStudentAvatar = cloudinaryUtils.uploadStudentAvatar || cloudinaryUtils.uploadToCloudinary?.uploadStudentAvatar;
        
        if (!uploadStudentAvatar) {
          throw new Error('uploadStudentAvatar function not found in cloudinary utils');
        }
        
        console.log('📤 Uploading avatar to Cloudinary (NOT to local storage)...');
        const uploadResult = await uploadStudentAvatar(avatarFile.buffer, student._id.toString());
        
        if (!uploadResult || !uploadResult.secure_url) {
          throw new Error('Cloudinary upload returned invalid result - no secure_url');
        }
        
        console.log(`✅ Cloudinary upload successful:`, {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          url: uploadResult.url
        });
        
        // Update student with avatar URL from Cloudinary
        student.avatar = uploadResult.secure_url;
        const savedStudent = await student.save();
        console.log(`✅ Avatar saved to student record. Student ID: ${savedStudent._id}, Avatar URL: ${savedStudent.avatar}`);
        
        // Verify it was saved
        const verifyStudent = await Student.findById(student._id).select('avatar name');
        if (verifyStudent.avatar) {
          console.log(`✅ Verification - Student "${verifyStudent.name}" avatar in DB: ${verifyStudent.avatar}`);
        } else {
          console.error(`❌ Verification FAILED - Student "${verifyStudent.name}" avatar NOT found in DB`);
        }
      } catch (avatarError) {
        console.error('❌ Avatar upload error:', avatarError);
        console.error('Error details:', avatarError.message);
        if (avatarError.stack) {
          console.error('Stack trace:', avatarError.stack);
        }
        // Continue without avatar if upload fails
        console.log('⚠️ Student created but avatar upload failed - student will be created without avatar');
      }
    } else {
      console.log('⚠️ No avatar file found in request - student will be created without avatar');
      if (req.files) {
        console.log('Available file fields:', Object.keys(req.files));
        Object.keys(req.files).forEach(key => {
          const field = req.files[key];
          if (Array.isArray(field)) {
            console.log(`  Field '${key}': ${field.length} file(s)`);
            field.forEach((file, idx) => {
              console.log(`    [${idx}] ${file.originalname || 'unnamed'} - ${file.size} bytes - ${file.mimetype}`);
            });
          } else {
            console.log(`  Field '${key}': ${field.originalname || 'unnamed'} - ${field.size} bytes - ${field.mimetype}`);
          }
        });
      } else {
        console.log('⚠️ req.files is null or undefined');
      }
    }

    // Create or update parent records if parent info is provided
    const createdParents = [];
    
    // Use the new parentDetails structure or fall back to old parentInfo
    let finalParentDetails = parentDetails;
    if (!finalParentDetails && parentName) {
      // Build parent details from individual fields for backward compatibility
      finalParentDetails = {
        name: parentName,
        relation: parentRelation || 'parent',
        contact: parentPhone || phone,
        email: parentEmail || email,
        password: parentPassword || password
      };
    }
    
    // Helper function to create or link parent
    const createOrLinkParent = async (parentData) => {
      const { email, password, name, contact: phoneNum, relation } = parentData;
      
      // Validate parent data
      if (!email || !password || !name) {
        return null; // Skip invalid parent entries
      }
      
      // Check if parent email already exists globally (across all schools)
      const existingParentEmail = await Parent.findOne({ 
        email: email.toLowerCase()
      });
      
      // Check if parent phone already exists globally (if provided)
      let existingParentPhone = null;
      if (phoneNum) {
        existingParentPhone = await Parent.findOne({ phone: phoneNum });
      }

      // If parent exists with same email or phone, link to existing parent
      const existingParent = existingParentEmail || existingParentPhone;
      
      if (existingParent) {
        // Parent exists - add this student to their children list
        console.log(`📝 Found existing parent: ${email}`);
        
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
        console.log(`✅ Added student ${student._id} to existing parent, total children: ${existingParent.studentIds.length}`);
        return existingParent;
      } else {
        // Parent doesn't exist - create new parent record
        // But first check if email or phone is already taken by another parent
        if (email) {
          const emailExists = await Parent.findOne({ email: email.toLowerCase() });
          if (emailExists) {
            throw new Error(`A parent with email ${email} already exists in the system`);
          }
        }
        if (phoneNum) {
          const phoneExists = await Parent.findOne({ phone: phoneNum });
          if (phoneExists) {
            throw new Error(`A parent with phone number ${phoneNum} already exists in the system`);
          }
        }
        
        console.log(`📝 Creating new parent: ${email}`);
        const parentTypeValue = relation === 'father' ? 'father' : relation === 'mother' ? 'mother' : 'guardian';
        const newParent = await Parent.create({
          name: name || parentTypeValue.charAt(0).toUpperCase() + parentTypeValue.slice(1),
          email: email.toLowerCase(),
          password: password,
          phone: phoneNum || '',
          parentType: parentTypeValue,
          studentId: student._id,
          studentIds: [student._id],
          schoolId: schoolId
        });
        const parentTypeStr = relation === 'father' ? 'father' : relation === 'mother' ? 'mother' : 'guardian';
        console.log(`✅ Created new ${parentTypeStr} parent with student ${student._id}`);
        
        // Create User record for parent authentication
        try {
          const User = require('../models/User');
          const userExists = await User.findOne({ email: email.toLowerCase() });
          if (!userExists) {
            await User.create({
              email: email.toLowerCase(),
              password: password,
              role: 'parent',
              schoolId: schoolId,
              parentId: newParent._id
            });
            console.log(`✅ Created User account for parent ${email}`);
          }
        } catch (userError) {
          console.warn(`⚠️ Could not create User account for parent:`, userError.message);
        }
        
        return newParent;
      }
    };
    
    // Process parent details
    if (finalParentDetails && finalParentDetails.email && finalParentDetails.password) {
      try {
        const parentRecord = await createOrLinkParent({
          email: finalParentDetails.email,
          password: finalParentDetails.password,
          name: finalParentDetails.name,
          contact: finalParentDetails.contact,
          relation: finalParentDetails.relation || 'guardian'
        });
        if (parentRecord) {
          createdParents.push(parentRecord);
        }
      } catch (error) {
        console.error('Error processing parent:', error.message);
        // Continue even if parent creation fails
      }
    }
    
    // Also process old parentInfo structure if present for backward compatibility
    const parentInfo = req.body.parentInfo;
    
    // Process father
    if (parentInfo?.fatherEmail && parentInfo?.fatherPassword) {
      try {
        const fatherParent = await createOrLinkParent({
          email: parentInfo.fatherEmail,
          password: parentInfo.fatherPassword,
          name: parentInfo.fatherName,
          contact: parentInfo.fatherPhone,
          relation: 'father'
        });
        if (fatherParent) {
          createdParents.push(fatherParent);
        }
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
          contact: parentInfo.motherPhone,
          relation: 'mother'
        });
        if (motherParent) {
          createdParents.push(motherParent);
        }
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
          contact: parentInfo.guardianPhone,
          relation: 'guardian'
        });
        if (guardianParent) {
          createdParents.push(guardianParent);
        }
      } catch (error) {
        console.error('Error processing guardian parent:', error.message);
        // Continue with other parents even if one fails
      }
    }

    // Update school student count
    await School.findByIdAndUpdate(schoolId, { $inc: { students: 1 } });

    // Reload student from database to get latest data including avatar
    const finalStudentDoc = await Student.findById(student._id)
      .populate('classId', 'name section')
      .populate('houseId', 'name color')
      .populate('schoolId', 'name code');
    
    // Convert to plain object and ensure avatar is included
    const finalStudent = finalStudentDoc.toObject();
    
    // Ensure avatar is included - check both finalStudent and the original student object
    if (!finalStudent.avatar) {
      // Try to get avatar from the mongoose document
      if (finalStudentDoc.avatar) {
        finalStudent.avatar = finalStudentDoc.avatar;
        console.log('✅ Avatar retrieved from mongoose document:', finalStudent.avatar);
      } else if (student.avatar) {
        finalStudent.avatar = student.avatar;
        console.log('⚠️ Using avatar from in-memory student object:', finalStudent.avatar);
      } else {
        // Final check - query database directly
        const avatarCheck = await Student.findById(student._id).select('avatar').lean();
        if (avatarCheck && avatarCheck.avatar) {
          finalStudent.avatar = avatarCheck.avatar;
          console.log('✅ Avatar retrieved from direct database query:', finalStudent.avatar);
        } else {
          console.log('⚠️ No avatar found anywhere');
        }
      }
    } else {
      console.log('✅ Avatar already in finalStudent:', finalStudent.avatar);
    }
    
    console.log('✅ Final student data before response:', {
      id: finalStudent._id,
      name: finalStudent.name,
      hasAvatar: !!finalStudent.avatar,
      avatar: finalStudent.avatar || 'null',
      avatarLength: finalStudent.avatar ? finalStudent.avatar.length : 0,
      pdfsCount: finalStudent.pdfs ? finalStudent.pdfs.length : 0,
      pdfs: finalStudent.pdfs || []
    });
    
    // finalStudent is already a plain object (from lean()), so use it directly
    const studentResponse = finalStudent;

    res.status(201).json({
      success: true,
      message: 'Student created successfully with login credentials',
      data: {
        student: studentResponse,
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

    const schoolId = req.user.schoolId;
    const { email, rollNumber, admissionNumber, phone } = req.body;

    // Check for uniqueness if email is being updated (globally unique)
    if (email) {
      const existingEmail = await Student.findOne({
        email: email.toLowerCase(),
        _id: { $ne: req.params.id } // Exclude current student
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Another student with this email already exists in the system'
        });
      }
    }

    // Check for uniqueness if phone is being updated (globally unique)
    if (phone) {
      const existingPhone = await Student.findOne({
        phone: phone,
        _id: { $ne: req.params.id } // Exclude current student
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: 'Another student with this phone number already exists in the system'
        });
      }
    }

    // Check for uniqueness if rollNumber or admissionNumber is being updated (per school)
    if (rollNumber || admissionNumber) {
      const uniquenessQuery = {
        schoolId: schoolId,
        _id: { $ne: req.params.id }, // Exclude current student
        $or: []
      };

      if (rollNumber) {
        uniquenessQuery.$or.push({ rollNumber });
      }
      if (admissionNumber) {
        uniquenessQuery.$or.push({ admissionNumber });
      }

      if (uniquenessQuery.$or.length > 0) {
        const existingStudent = await Student.findOne(uniquenessQuery);
        if (existingStudent) {
          return res.status(400).json({
            success: false,
            error: 'Another student already exists with this roll number or admission number in your school'
          });
        }
      }
    }

    // Handle avatar upload to Cloudinary first if new avatar provided
    let updateData = { ...req.body };
    
    if (req.files?.avatar?.[0]) {
      const avatarFile = req.files.avatar[0];
      try {
        // Import uploadStudentAvatar function - ensure it's available
        const cloudinaryUtils = require('../utils/cloudinary');
        const uploadStudentAvatar = cloudinaryUtils.uploadStudentAvatar || cloudinaryUtils.uploadToCloudinary?.uploadStudentAvatar;
        
        if (!uploadStudentAvatar) {
          throw new Error('uploadStudentAvatar function not found in cloudinary utils');
        }
        
        console.log('📤 Uploading avatar to Cloudinary (NOT to local storage)...');
        const uploadResult = await uploadStudentAvatar(avatarFile.buffer, req.params.id);
        
        if (!uploadResult || !uploadResult.secure_url) {
          throw new Error('Cloudinary upload returned invalid result - no secure_url');
        }
        
        updateData.avatar = uploadResult.secure_url;
        console.log(`✅ Avatar updated on Cloudinary: ${uploadResult.public_id}, URL: ${uploadResult.secure_url}`);
      } catch (avatarError) {
        console.error('❌ Avatar upload error:', avatarError);
        console.error('Error details:', avatarError.message);
        // Continue without updating avatar if upload fails
      }
    }

    // Handle address - parse from JSON string if it's a string (from FormData)
    if (typeof updateData.address === 'string') {
      try {
        updateData.address = JSON.parse(updateData.address);
      } catch (e) {
        // If parsing fails, keep as is or set to empty object
        updateData.address = {};
      }
    }
    
    // Handle medicalInfo - parse from JSON string if it's a string (from FormData)
    if (typeof updateData.medicalInfo === 'string') {
      try {
        updateData.medicalInfo = JSON.parse(updateData.medicalInfo);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    
    // Verify house exists if being updated
    if (updateData.houseId) {
      const House = require('../models/House');
      const houseExists = await House.findOne({ _id: updateData.houseId, schoolId });
      if (!houseExists) {
        return res.status(400).json({
          success: false,
          error: 'House not found or does not belong to your school'
        });
      }
    }

    // Handle dormitory room number - clear if isDormitory is false
    if (updateData.isDormitory === false || updateData.isDormitory === 'false') {
      updateData.roomNumber = null;
      updateData.isDormitory = false;
    } else if (updateData.isDormitory === true || updateData.isDormitory === 'true') {
      updateData.isDormitory = true;
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('classId', 'name section')
      .populate('houseId', 'name color')
      .populate('schoolId', 'name code');

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

    const { email, password, schoolCode } = req.body;

    // Build query to find student - if schoolCode provided, filter by school
    let studentQuery = { email: email.toLowerCase() };
    
    // If schoolCode is provided, find the school first and filter by schoolId
    if (schoolCode) {
      const School = require('../models/School');
      const school = await School.findOne({ code: schoolCode.toUpperCase() });
      if (!school) {
        return res.status(400).json({
          success: false,
          error: 'Invalid school code'
        });
      }
      studentQuery.schoolId = school._id;
    }

    // Find student(s) matching the email (and school if provided)
    const students = await Student.find(studentQuery).select('+password');
    
    if (students.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // If multiple students found and no schoolCode provided, ask for school identification
    if (students.length > 1 && !schoolCode) {
      // Get unique school codes for the matching students
      const School = require('../models/School');
      const schoolIds = [...new Set(students.map(s => s.schoolId.toString()))];
      const schools = await School.find({ _id: { $in: schoolIds } }).select('name code');
      
      return res.status(400).json({
        success: false,
        error: 'Multiple accounts found with this email. Please provide your school code.',
        schools: schools.map(s => ({ name: s.name, code: s.code }))
      });
    }

    // Get the student (either the only one, or the one matching the schoolCode)
    const student = students[0];

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

    // Ensure student has role set for token generation
    if (!student.role) {
      student.role = 'student';
    }

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

    const { email, password, schoolCode } = req.body;

    // Build query to find parent - if schoolCode provided, filter by school
    let parentQuery = { email: email.toLowerCase() };
    
    // If schoolCode is provided, find the school first and filter by schoolId
    if (schoolCode) {
      const School = require('../models/School');
      const school = await School.findOne({ code: schoolCode.toUpperCase() });
      if (!school) {
        return res.status(400).json({
          success: false,
          error: 'Invalid school code'
        });
      }
      parentQuery.schoolId = school._id;
    }

    // Find parent(s) matching the email (and school if provided)
    const parents = await Parent.find(parentQuery).select('+password');

    if (parents.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // If multiple parents found and no schoolCode provided, ask for school identification
    if (parents.length > 1 && !schoolCode) {
      // Get unique school codes for the matching parents
      const School = require('../models/School');
      const schoolIds = [...new Set(parents.map(p => p.schoolId.toString()))];
      const schools = await School.find({ _id: { $in: schoolIds } }).select('name code');
      
      return res.status(400).json({
        success: false,
        error: 'Multiple accounts found with this email. Please provide your school code.',
        schools: schools.map(s => ({ name: s.name, code: s.code }))
      });
    }

    // Get the parent (either the only one, or the one matching the schoolCode)
    const parent = parents[0];

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
          avatar: student.avatar,
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
    const { date, week, timetable } = req.query;
    const student = await Student.findById(req.user._id).populate('classId', '_id name section');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    if (!student.classId) {
      console.log('📅 Student has no classId assigned');
      return res.status(404).json({
        success: false,
        error: 'Student not assigned to any class'
      });
    }

    const Schedule = require('../models/Schedule');
    
    // If timetable=true, return weekly timetable grouped by dayOfWeek
    if (timetable === 'true' || (!date && !week)) {
      console.log('📅 Getting timetable for student:', {
        studentId: student._id,
        classId: student.classId,
        classIdType: typeof student.classId,
        classIdValue: student.classId?._id || student.classId,
        schoolId: student.schoolId
      });
      
      // Get classId - handle both object and string formats
      const classId = student.classId?._id || student.classId?.id || student.classId;
      if (!classId) {
        return res.status(404).json({
          success: false,
          error: 'Student not assigned to any class'
        });
      }
      
      // Try to get schedules without academic year filter first, then with current academic year
      // This ensures we get schedules regardless of academic year format
      const currentYear = new Date().getFullYear();
      const academicYears = [
        `${currentYear}-${currentYear + 1}`,  // 2025-2026
        `${currentYear - 1}-${currentYear}`,  // 2024-2025
        `${currentYear + 1}-${currentYear + 2}`, // 2026-2027 (future)
      ];
      
      console.log('📅 Trying academic years:', academicYears);
      
      let schedules = [];
      let usedAcademicYear = null;
      
      // Try each academic year format
      for (const academicYear of academicYears) {
        const foundSchedules = await Schedule.getScheduleByClass(classId.toString(), academicYear);
        if (foundSchedules.length > 0) {
          schedules = foundSchedules;
          usedAcademicYear = academicYear;
          console.log('📅 Found schedules with academic year:', academicYear, 'Count:', schedules.length);
          break;
        }
      }
      
      // If still no schedules, try without academic year filter
      if (schedules.length === 0) {
        console.log('📅 No schedules found with academic year filter, trying without filter...');
        schedules = await Schedule.find({
          classId: classId,
          status: 'active'
        })
        .populate('teacherId', 'name email')
        .populate('subjectId', 'name code')
        .sort({ dayOfWeek: 1, startTime: 1 });
        console.log('📅 Found schedules without academic year filter:', schedules.length);
      }
      
      console.log('📅 Total schedules found:', schedules.length);
      
      if (schedules.length > 0) {
        console.log('📅 Sample schedule:', {
          dayOfWeek: schedules[0].dayOfWeek,
          subjectId: schedules[0].subjectId,
          startTime: schedules[0].startTime,
          endTime: schedules[0].endTime,
          academicYear: schedules[0].academicYear
        });
      } else {
        // Check if there are any schedules for this class at all
        const allSchedules = await Schedule.find({ classId: classId });
        console.log('📅 Total schedules for class (any status):', allSchedules.length);
        if (allSchedules.length > 0) {
          console.log('📅 Sample schedule (any status):', {
            status: allSchedules[0].status,
            academicYear: allSchedules[0].academicYear,
            dayOfWeek: allSchedules[0].dayOfWeek
          });
        }
      }
      
      // Group schedules by dayOfWeek
      const timetableByDay = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: []
      };
      
      schedules.forEach(schedule => {
        if (schedule.dayOfWeek && timetableByDay[schedule.dayOfWeek]) {
          timetableByDay[schedule.dayOfWeek].push(schedule);
        }
      });
      
      // Sort each day's schedules by startTime
      Object.keys(timetableByDay).forEach(day => {
        timetableByDay[day].sort((a, b) => {
          const timeA = a.startTime.split(':').map(Number);
          const timeB = b.startTime.split(':').map(Number);
          return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
        });
      });
      
      const totalSchedules = Object.values(timetableByDay).reduce((sum, day) => sum + day.length, 0);
      console.log('📅 Timetable grouped by day:', {
        Monday: timetableByDay.Monday.length,
        Tuesday: timetableByDay.Tuesday.length,
        Wednesday: timetableByDay.Wednesday.length,
        Thursday: timetableByDay.Thursday.length,
        Friday: timetableByDay.Friday.length,
        Saturday: timetableByDay.Saturday.length,
        Sunday: timetableByDay.Sunday.length,
        total: totalSchedules
      });
      
      return res.status(200).json({
        success: true,
        data: timetableByDay,
        academicYear: usedAcademicYear || 'N/A',
        totalSchedules: totalSchedules
      });
    }
    
    // Otherwise, return date-based schedules (for backward compatibility)
    let query = { 
      classId: student.classId,
      schoolId: student.schoolId,
      status: 'active'
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
