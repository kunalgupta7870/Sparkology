const express = require('express');
const fs = require('fs');
const path = require('path');
const { protect, authorize } = require('../middleware/auth');
const {
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
} = require('../controllers/studentController');
const {
  studentValidation,
  studentUpdateValidation,
  loginValidation
} = require('../middleware/studentValidation');
const { uploadDocument, handleUploadError } = require('../utils/cloudinary');

const router = express.Router();

// Public routes (no authentication required)
router.post('/login', loginValidation, studentLogin);
router.post('/parents/login', loginValidation, parentLogin);

// Serve student PDF documents - public route (before protect middleware)
// Handles URL-encoded filenames and finds actual files
router.get('/documents/*', (req, res) => {
  try {
    // Extract filename from the path (everything after /documents/)
    const requestedFilename = decodeURIComponent(req.path.replace('/documents/', ''));
    const documentsPath = path.join(__dirname, '../uploads/documents');
    
    // Try to find the file - first try exact match, then try sanitized version
    let filePath = path.join(documentsPath, requestedFilename);
    
    // If file doesn't exist, try to find by sanitized name
    if (!fs.existsSync(filePath)) {
      // Sanitize the filename (replace special chars with underscore)
      const sanitized = requestedFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      // Search for files that match the sanitized pattern
      if (fs.existsSync(documentsPath)) {
        const files = fs.readdirSync(documentsPath);
        const matchingFile = files.find(file => {
          // Check if file contains the sanitized name (after student- prefix)
          const fileWithoutPrefix = file.replace(/^student-\d+-\d+-/, '');
          // Also check original filename match
          const originalNameMatch = file.includes(requestedFilename.replace(/[^a-zA-Z0-9.-]/g, '_'));
          return fileWithoutPrefix === sanitized || file === sanitized || originalNameMatch || file.includes(sanitized);
        });
        
        if (matchingFile) {
          filePath = path.join(documentsPath, matchingFile);
        }
      }
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: `File not found: ${requestedFilename}`
      });
    }
    
    // Set content type for PDF
    res.setHeader('Content-Type', 'application/pdf');
    // Send the file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve PDF'
    });
  }
});

// Protected routes (authentication required)
router.use(protect);

// Student-specific routes (for students themselves)
router.get('/profile', authorize('student'), getStudentProfile);
router.get('/classes', authorize('student'), getStudentClasses);
router.get('/schedule', authorize('student'), getStudentSchedule);
router.get('/assignments', authorize('student'), getStudentAssignments);
router.get('/notes', authorize('student'), getStudentNotes);
router.get('/attendance', authorize('student'), getStudentAttendance);
router.get('/exam-marks', authorize('student'), getStudentExamMarks);
router.get('/class-contacts', authorize('student'), getClassContacts);

// Student management routes (School Admin, Teachers, and Librarians for library operations)
router.get('/', authorize('school_admin', 'teacher', 'librarian'), getStudents);
router.get('/stats', authorize('school_admin'), getStudentStats);
router.get('/performance-report', authorize('school_admin', 'teacher'), getStudentPerformanceReport);

// Upload PDFs for student - must be before /:id route to avoid conflicts
router.post('/upload-pdfs', authorize('school_admin'), uploadDocument.array('pdfs', 10), handleUploadError, (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Verify files are saved correctly and can be accessed
    const fileUrls = req.files.map(file => {
      const filePath = path.join(__dirname, '../uploads/documents', file.filename);
      const fileUrl = `/uploads/documents/${file.filename}`;
      
      // Verify file exists and is readable
      if (fs.existsSync(filePath)) {
        console.log(`✅ PDF saved successfully: ${file.filename}`);
        console.log(`   Path: ${filePath}`);
        console.log(`   URL: ${fileUrl}`);
        console.log(`   Size: ${file.size} bytes`);
      } else {
        console.error(`❌ PDF file not found after upload: ${filePath}`);
      }
      
      return fileUrl;
    });
    
    res.status(200).json({
      success: true,
      data: fileUrls
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload PDFs'
    });
  }
});

router.post('/', authorize('school_admin'), studentValidation, createStudent);
router.get('/:id', authorize('school_admin', 'teacher', 'parent'), getStudent);
router.get('/:id/performance', authorize('school_admin', 'teacher', 'parent'), getStudentPerformance);
router.put('/:id', authorize('school_admin'), studentUpdateValidation, updateStudent);
router.put('/:id/assign-class', authorize('school_admin'), assignStudentToClass);
router.put('/:id/remove-class', authorize('school_admin'), removeStudentFromClass);
router.delete('/:id', authorize('school_admin'), deleteStudent);

module.exports = router;
