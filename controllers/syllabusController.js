const Syllabus = require('../models/Syllabus');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all syllabus
// @route   GET /api/syllabus
// @access  Private (School Admin)
const getSyllabus = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { classId, subjectId, teacherId, academicYear, status } = req.query;
    
    let query = { schoolId };
    
    // Only filter by status if provided, otherwise return all statuses
    if (status) {
      query.status = status;
    }
    
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    if (teacherId) query.teacherId = teacherId;
    if (academicYear) query.academicYear = academicYear;
    
    const syllabus = await Syllabus.find(query)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ academicYear: -1, 'classId.name': 1, 'subjectId.name': 1 });

    res.status(200).json({
      success: true,
      count: syllabus.length,
      data: syllabus
    });
  } catch (error) {
    console.error('Get syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching syllabus'
    });
  }
};

// @desc    Get syllabus by ID
// @route   GET /api/syllabus/:id
// @access  Private (School Admin or Teacher - for their own syllabus)
const getSyllabusById = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    let query = { _id: req.params.id };
    
    // If teacher, only allow access to their own syllabus
    if (userRole === 'teacher') {
      query.teacherId = userId;
      query.status = 'active';
    } else {
      // Admin can access any syllabus in their school
      query.schoolId = schoolId;
    }
    
    const syllabus = await Syllabus.findOne(query)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        error: 'Syllabus not found'
      });
    }

    res.status(200).json({
      success: true,
      data: syllabus
    });
  } catch (error) {
    console.error('Get syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching syllabus'
    });
  }
};

// @desc    Create new syllabus
// @route   POST /api/syllabus
// @access  Private (School Admin)
const createSyllabus = async (req, res) => {
  try {
    console.log('📝 Create syllabus request:', {
      hasFiles: !!(req.files && req.files.length > 0),
      bodyKeys: Object.keys(req.body),
      contentType: req.headers['content-type']
    });
    
    // Check for validation errors (only if validation rules exist)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Handle both JSON and FormData requests
    let classId, subjectId, teacherId, academicYear, syllabusContent, topics, learningObjectives, assessmentCriteria, resources, category, contentType;
    
    // Check if request has files (FormData) or is JSON
    const hasFiles = req.files && req.files.length > 0;
    
    if (hasFiles) {
      // FormData request - parse fields
      classId = req.body.classId;
      subjectId = req.body.subjectId;
      teacherId = req.body.teacherId || null;
      academicYear = req.body.academicYear;
      syllabusContent = req.body.syllabusContent || '';
      assessmentCriteria = req.body.assessmentCriteria || '';
      category = req.body.category || '';
      contentType = req.body.contentType || 'syllabus';
      
      // Parse JSON strings for arrays
      try {
        topics = req.body.topics ? JSON.parse(req.body.topics) : [];
        learningObjectives = req.body.learningObjectives ? JSON.parse(req.body.learningObjectives) : [];
        resources = req.body.resources ? JSON.parse(req.body.resources) : [];
      } catch (parseError) {
        topics = [];
        learningObjectives = [];
        resources = [];
      }
    } else {
      // JSON request
      ({ classId, subjectId, teacherId, academicYear, syllabusContent, topics, learningObjectives, assessmentCriteria, resources, category, contentType } = req.body);
    }
    
    const schoolId = req.user.schoolId;

    // Verify class exists and belongs to the school
    const classExists = await Class.findOne({ _id: classId, schoolId });
    if (!classExists) {
      return res.status(400).json({
        success: false,
        error: 'Class not found or does not belong to your school'
      });
    }

    // Verify subject exists and belongs to the school
    const subjectExists = await Subject.findOne({ _id: subjectId, schoolId });
    if (!subjectExists) {
      return res.status(400).json({
        success: false,
        error: 'Subject not found or does not belong to your school'
      });
    }

    // Verify teacher exists and belongs to the school (if provided)
    if (teacherId) {
      const teacherExists = await User.findOne({ _id: teacherId, schoolId, role: 'teacher' });
      if (!teacherExists) {
        return res.status(400).json({
          success: false,
          error: 'Teacher not found or does not belong to your school'
        });
      }
    }

    // Check if syllabus already exists for this class-subject-teacher-academic year combination
    const existingSyllabusQuery = {
      classId,
      subjectId,
      academicYear,
      schoolId
    };
    
    // Include teacherId in query if provided, otherwise check for null
    if (teacherId) {
      existingSyllabusQuery.teacherId = teacherId;
    } else {
      existingSyllabusQuery.teacherId = null;
    }

    const existingSyllabus = await Syllabus.findOne(existingSyllabusQuery);

    if (existingSyllabus) {
      return res.status(400).json({
        success: false,
        error: 'Syllabus already exists for this class, subject, teacher, and academic year combination'
      });
    }

    // Handle file uploads if present
    const documents = [];
    console.log('📁 File upload check:', {
      hasFiles: !!(req.files && req.files.length > 0),
      filesCount: req.files ? req.files.length : 0,
      files: req.files ? req.files.map(f => ({ name: f.originalname, filename: f.filename, size: f.size })) : []
    });
    
    if (req.files && req.files.length > 0) {
      const path = require('path');
      
      req.files.forEach((file) => {
        // Store relative path only (like assignments) - frontend will construct full URL
        // This ensures mobile apps can access files using their configured API_BASE_URL
        const fileUrl = `/uploads/documents/${file.filename}`;
        const documentEntry = {
          name: file.originalname,
          description: `Uploaded file: ${file.originalname}`,
          type: 'syllabus',
          url: fileUrl,
          uploadedAt: new Date()
        };
        documents.push(documentEntry);
        console.log('📄 Document entry created:', documentEntry);
      });
    }

    // Create syllabus
    const syllabusData = {
      classId,
      subjectId,
      teacherId: teacherId || null,
      schoolId,
      academicYear,
      syllabusContent: syllabusContent || '',
      topics: topics || [],
      learningObjectives: learningObjectives || [],
      assessmentCriteria: assessmentCriteria || '',
      resources: resources || [],
      category: category || '',
      contentType: contentType || 'syllabus',
      createdBy: req.user._id
    };

    // Always add documents array if files were uploaded
    if (documents.length > 0) {
      syllabusData.documents = documents;
      console.log('💾 Adding documents to syllabus:', documents.length, 'files');
    }

    console.log('💾 Creating syllabus with data:', {
      classId: syllabusData.classId,
      subjectId: syllabusData.subjectId,
      documentsCount: syllabusData.documents ? syllabusData.documents.length : 0
    });
    
    const syllabus = await Syllabus.create(syllabusData);

    console.log('✅ Syllabus created:', {
      id: syllabus._id,
      documentsCount: syllabus.documents ? syllabus.documents.length : 0
    });

    // Populate the created syllabus
    await syllabus.populate('classId', 'name section');
    await syllabus.populate('subjectId', 'name code');
    await syllabus.populate('teacherId', 'name email');
    await syllabus.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Syllabus created successfully',
      data: syllabus
    });
  } catch (error) {
    console.error('Create syllabus error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Syllabus already exists for this class, subject, and academic year combination'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error during syllabus creation'
    });
  }
};

// @desc    Update syllabus
// @route   PUT /api/syllabus/:id
// @access  Private (School Admin)
const updateSyllabus = async (req, res) => {
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

    const schoolId = req.user.schoolId;
    
    const syllabus = await Syllabus.findOne({ 
      _id: req.params.id,
      schoolId 
    });

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        error: 'Syllabus not found'
      });
    }

    // Handle both JSON and FormData requests
    let updateData = {};
    
    // Check if request has files (FormData) or is JSON
    const hasFiles = req.files && req.files.length > 0;
    
    if (hasFiles) {
      // FormData request - parse fields
      if (req.body.classId) updateData.classId = req.body.classId;
      if (req.body.subjectId) updateData.subjectId = req.body.subjectId;
      if (req.body.teacherId !== undefined) updateData.teacherId = req.body.teacherId || null;
      if (req.body.academicYear) updateData.academicYear = req.body.academicYear;
      if (req.body.syllabusContent !== undefined) updateData.syllabusContent = req.body.syllabusContent;
      if (req.body.assessmentCriteria !== undefined) updateData.assessmentCriteria = req.body.assessmentCriteria;
      if (req.body.category !== undefined) updateData.category = req.body.category;
      if (req.body.contentType) updateData.contentType = req.body.contentType;
      
      // Parse JSON strings for arrays
      try {
        if (req.body.topics) updateData.topics = JSON.parse(req.body.topics);
        if (req.body.learningObjectives) updateData.learningObjectives = JSON.parse(req.body.learningObjectives);
        if (req.body.resources) updateData.resources = JSON.parse(req.body.resources);
      } catch (parseError) {
        // Keep existing values if parsing fails
      }

      // Handle file uploads and document management
      const path = require('path');
      const fs = require('fs');
      const newDocuments = [];
      
      console.log('📁 Update - File upload check:', {
        hasFiles: !!(req.files && req.files.length > 0),
        filesCount: req.files ? req.files.length : 0,
        existingDocuments: syllabus.documents ? syllabus.documents.length : 0,
        bodyDocuments: req.body.existingDocuments
      });
      
      // Handle new file uploads
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          // Store relative path only (like assignments) - frontend will construct full URL
          const fileUrl = `/uploads/documents/${file.filename}`;
          const documentEntry = {
            name: file.originalname,
            description: `Uploaded file: ${file.originalname}`,
            type: 'syllabus',
            url: fileUrl,
            uploadedAt: new Date()
          };
          newDocuments.push(documentEntry);
          console.log('📄 Update - Document entry created:', documentEntry);
        });
      }

      // Handle existing documents - if existingDocuments is provided in body, use it
      // Otherwise, keep existing documents and add new ones
      if (req.body.existingDocuments !== undefined) {
        try {
          const existingDocs = typeof req.body.existingDocuments === 'string' 
            ? JSON.parse(req.body.existingDocuments) 
            : req.body.existingDocuments;
          
          // Get IDs of documents to keep
          const keepDocumentIds = existingDocs.map((doc) => doc._id || doc.url);
          
          // Filter existing documents to keep only those in the list
          const documentsToKeep = (syllabus.documents || []).filter((doc) => {
            const docId = doc._id?.toString() || doc.url;
            return keepDocumentIds.includes(docId);
          });

          // Delete files that were removed
          const documentsToRemove = (syllabus.documents || []).filter((doc) => {
            const docId = doc._id?.toString() || doc.url;
            return !keepDocumentIds.includes(docId);
          });

          // Delete removed files from file system
          const documentsPath = path.join(__dirname, '../uploads/documents');
          documentsToRemove.forEach((doc) => {
            if (doc.url) {
              try {
                const urlParts = doc.url.split('/');
                const filename = urlParts[urlParts.length - 1];
                const filePath = path.join(documentsPath, filename);
                
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  console.log(`🗑️ Deleted removed file: ${filename}`);
                }
              } catch (fileError) {
                console.error(`Error deleting file ${doc.url}:`, fileError);
              }
            }
          });

          // Combine kept documents with new ones
          updateData.documents = [...documentsToKeep, ...newDocuments];
          console.log('💾 Update - Documents after edit:', {
            kept: documentsToKeep.length,
            new: newDocuments.length,
            removed: documentsToRemove.length,
            total: updateData.documents.length
          });
        } catch (parseError) {
          console.error('Error parsing existingDocuments:', parseError);
          // Fallback: keep existing and add new
          updateData.documents = [...(syllabus.documents || []), ...newDocuments];
        }
      } else if (newDocuments.length > 0) {
        // No existingDocuments in body, just add new files to existing ones
        updateData.documents = [...(syllabus.documents || []), ...newDocuments];
      }
    } else {
      // JSON request
      updateData = { ...req.body };
      
      // Handle existing documents in JSON request
      if (req.body.existingDocuments !== undefined) {
        const fs = require('fs');
        const path = require('path');
        
        const existingDocs = Array.isArray(req.body.existingDocuments) 
          ? req.body.existingDocuments 
          : [];
        
        // Get IDs/URLs of documents to keep
        const keepDocumentIds = existingDocs.map((doc) => doc._id?.toString() || doc.url);
        
        // Filter existing documents to keep only those in the list
        const documentsToKeep = (syllabus.documents || []).filter((doc) => {
          const docId = doc._id?.toString() || doc.url;
          return keepDocumentIds.includes(docId);
        });

        // Delete files that were removed
        const documentsToRemove = (syllabus.documents || []).filter((doc) => {
          const docId = doc._id?.toString() || doc.url;
          return !keepDocumentIds.includes(docId);
        });

        // Delete removed files from file system
        const documentsPath = path.join(__dirname, '../uploads/documents');
        documentsToRemove.forEach((doc) => {
          if (doc.url) {
            try {
              const urlParts = doc.url.split('/');
              const filename = urlParts[urlParts.length - 1];
              const filePath = path.join(documentsPath, filename);
              
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Deleted removed file: ${filename}`);
              }
            } catch (fileError) {
              console.error(`Error deleting file ${doc.url}:`, fileError);
            }
          }
        });

        // Set documents to keep (new files will be added separately if any)
        updateData.documents = documentsToKeep;
        console.log('💾 JSON Update - Documents after edit:', {
          kept: documentsToKeep.length,
          removed: documentsToRemove.length
        });
      }
    }

    updateData.updatedBy = req.user._id;

    // Verify teacher exists if being updated
    if (updateData.teacherId) {
      const teacherExists = await User.findOne({ 
        _id: updateData.teacherId, 
        schoolId, 
        role: 'teacher' 
      });
      if (!teacherExists) {
        return res.status(400).json({
          success: false,
          error: 'Teacher not found or does not belong to your school'
        });
      }
    }

    const updatedSyllabus = await Syllabus.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Syllabus updated successfully',
      data: updatedSyllabus
    });
  } catch (error) {
    console.error('Update syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during syllabus update'
    });
  }
};

// @desc    Delete syllabus
// @route   DELETE /api/syllabus/:id
// @access  Private (School Admin)
const deleteSyllabus = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const fs = require('fs');
    const path = require('path');
    
    const syllabus = await Syllabus.findOne({ 
      _id: req.params.id,
      schoolId 
    });

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        error: 'Syllabus not found'
      });
    }

    // Delete associated files from file system if they exist
    if (syllabus.documents && syllabus.documents.length > 0) {
      const documentsPath = path.join(__dirname, '../uploads/documents');
      
      syllabus.documents.forEach((doc) => {
        if (doc.url) {
          try {
            // Extract filename from URL
            const urlParts = doc.url.split('/');
            const filename = urlParts[urlParts.length - 1];
            const filePath = path.join(documentsPath, filename);
            
            // Check if file exists and delete it
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted file: ${filename}`);
            }
          } catch (fileError) {
            console.error(`Error deleting file ${doc.url}:`, fileError);
            // Continue even if file deletion fails
          }
        }
      });
    }

    // Hard delete - actually remove from database
    await Syllabus.findByIdAndDelete(req.params.id);

    console.log(`✅ Syllabus deleted from database: ${req.params.id}`);

    res.status(200).json({
      success: true,
      message: 'Syllabus deleted successfully from database'
    });
  } catch (error) {
    console.error('Delete syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during syllabus deletion'
    });
  }
};

// @desc    Get syllabus by class and subject
// @route   GET /api/syllabus/class/:classId/subject/:subjectId
// @access  Private (School Admin)
const getSyllabusByClassAndSubject = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { academicYear } = req.query;
    const schoolId = req.user.schoolId;

    let query = { classId, subjectId, schoolId, status: 'active' };
    if (academicYear) {
      query.academicYear = academicYear;
    }

    const syllabus = await Syllabus.find(query)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ academicYear: -1 });

    res.status(200).json({
      success: true,
      count: syllabus.length,
      data: syllabus
    });
  } catch (error) {
    console.error('Get syllabus by class and subject error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching syllabus'
    });
  }
};

// @desc    Get syllabus for teacher
// @route   GET /api/syllabus/teacher
// @access  Private (Teacher)
const getTeacherSyllabus = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { academicYear } = req.query;
    
    let query = { teacherId, status: 'active' };
    if (academicYear) query.academicYear = academicYear;
    
    const syllabus = await Syllabus.find(query)
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ academicYear: -1, 'classId.name': 1, 'subjectId.name': 1 });

    res.status(200).json({
      success: true,
      count: syllabus.length,
      data: syllabus
    });
  } catch (error) {
    console.error('Get teacher syllabus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching syllabus'
    });
  }
};

module.exports = {
  getSyllabus,
  getSyllabusById,
  createSyllabus,
  updateSyllabus,
  deleteSyllabus,
  getSyllabusByClassAndSubject,
  getTeacherSyllabus
};

