const Note = require('../models/Note');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const { validationResult } = require('express-validator');

// WebSocket instance (will be injected)
let io = null;

// Function to set WebSocket instance
const setSocketIO = (socketIO) => {
  io = socketIO;
  console.log('📝 Note Controller: SocketIO instance set:', !!io);
};

// @desc    Create a new note
// @route   POST /api/notes
// @access  Private (Teacher)
const createNote = async (req, res) => {
  try {
    // Skip express-validator for multipart form data
    // We'll do manual validation instead

    const {
      title,
      content,
      classId,
      subjectId,
      attachments
    } = req.body;

    console.log('📥 Backend: Received note data:', {
      title,
      content,
      classId,
      subjectId,
      attachments,
      files: req.files?.length || 0
    });
    
    console.log('📥 Backend: req.files details:', JSON.stringify(req.files, null, 2));

    // Manual validation
    if (!title || !content || !classId || !subjectId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, content, classId, and subjectId are required'
      });
    }

    const schoolId = req.user.schoolId;
    const teacherId = req.user._id;

    // Verify class and subject belong to teacher
    const classData = await Class.findOne({ _id: classId, schoolId });
    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    const subject = await Subject.findOne({ 
      _id: subjectId, 
      classId,
      teacherId,
      schoolId 
    });
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found or not assigned to teacher'
      });
    }

    // Prepare attachments from uploaded files (Local Storage)
    const fileAttachments = [];
    if (req.files && req.files.length > 0) {
      console.log('📎 Backend: Processing', req.files.length, 'files for note');
      
      req.files.forEach((file, index) => {
        console.log(`📎 Backend: File ${index}:`, {
          originalname: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size
        });
        
        // Use local file path
        const fileUrl = `/uploads/documents/${file.filename}`;
        
        console.log(`📎 Backend: Local file URL: ${fileUrl}`);
        
        fileAttachments.push({
          fileName: file.originalname,
          fileUrl: fileUrl, // Local file URL
          fileType: 'pdf',
          fileSize: file.size
        });
      });
      
      console.log('📎 Backend: Prepared attachments array:', JSON.stringify(fileAttachments, null, 2));
    }

    // Create note - Build data object carefully
    const noteData = {
      title,
      content,
      classId,
      subjectId,
      teacherId,
      schoolId,
      createdBy: teacherId
    };
    
    // Add attachments separately to avoid any stringification
    if (fileAttachments.length > 0) {
      noteData.attachments = fileAttachments;
    } else if (attachments) {
      noteData.attachments = attachments;
    } else {
      noteData.attachments = [];
    }

    console.log('💾 Backend: Note data type check:', {
      attachmentsIsArray: Array.isArray(noteData.attachments),
      attachmentsLength: noteData.attachments?.length,
      attachmentsType: typeof noteData.attachments,
      firstAttachment: noteData.attachments[0]
    });
    
    // Use new Note() instead of create() to avoid casting issues
    const note = new Note(noteData);
    await note.save();

    // Populate the note with related data
    await note.populate([
      { path: 'classId', select: 'name section' },
      { path: 'subjectId', select: 'name' },
      { path: 'teacherId', select: 'name email' }
    ]);

    // Get all students in the class to emit WebSocket events
    const students = await Student.find({ 
      classId: note.classId,
      schoolId: note.schoolId,
      status: 'active'
    });

    // Emit WebSocket event to notify students and parents about new note
    if (io && students.length > 0) {
      console.log(`📝 Backend: Emitting new_note event to ${students.length} students and their parents`);
      console.log(`📝 Backend: Io instance available:`, !!io);
      console.log(`📝 Backend: Students to notify:`, students.map(s => ({ id: s._id, name: s.name })));
      
      // Get all parents for these students
      const studentIds = students.map(s => s._id);
      const parents = await Parent.find({ studentId: { $in: studentIds } });
      console.log(`📝 Backend: Found ${parents.length} parents to notify`);
      
      // Emit to each student in the class
      students.forEach(student => {
        const roomName = `user_${student._id}`;
        console.log(`📝 Backend: Emitting to student room: ${roomName} for student: ${student.name}`);
        
        const noteData = note.toObject();
        console.log('📝 Backend: Note data being emitted:', {
          title: noteData.title,
          classId: noteData.classId,
          classIdType: typeof noteData.classId,
          classIdValue: noteData.classId
        });
        
        io.to(roomName).emit('new_note', {
          success: true,
          note: noteData, // Convert to plain object
          message: `New note: ${note.title}`
        });
      });
      
      // Emit to each parent of students in the class
      parents.forEach(parent => {
        const parentRoomName = `user_${parent._id}`;
        console.log(`📝 Backend: Emitting to parent room: ${parentRoomName} for parent: ${parent.name}`);
        
        const noteData = note.toObject();
        
        io.to(parentRoomName).emit('new_note', {
          success: true,
          note: noteData,
          message: `New note for your child: ${note.title}`
        });
      });
    } else {
      console.log(`❌ Backend: Cannot emit note event - io:`, !!io, 'students:', students.length);
    }

    res.status(201).json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating note'
    });
  }
};

// @desc    Get notes for a specific class and subject
// @route   GET /api/notes/class/:classId/subject/:subjectId
// @access  Private (Student, Teacher, Parent)
const getNotesForClassSubject = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const schoolId = req.user.schoolId;

    const notes = await Note.find({
      classId,
      subjectId,
      schoolId,
      isActive: true
    })
    .populate('teacherId', 'name email')
    .populate('subjectId', 'name')
    .populate('classId', 'name section')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: notes
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching notes'
    });
  }
};

// @desc    Get notes for a teacher
// @route   GET /api/notes/teacher
// @access  Private (Teacher)
const getNotesForTeacher = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const schoolId = req.user.schoolId;

    const notes = await Note.find({
      teacherId,
      schoolId,
      isActive: true
    })
    .populate('classId', 'name section')
    .populate('subjectId', 'name')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: notes
    });
  } catch (error) {
    console.error('Error fetching teacher notes:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching teacher notes'
    });
  }
};

// @desc    Get note by ID
// @route   GET /api/notes/:id
// @access  Private (Student, Teacher, Parent)
const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const note = await Note.findOne({
      _id: id,
      schoolId,
      isActive: true
    })
    .populate('teacherId', 'name email')
    .populate('subjectId', 'name')
    .populate('classId', 'name section');

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching note'
    });
  }
};

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private (Teacher - Note Creator)
const updateNote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { title, content, attachments } = req.body;
    const teacherId = req.user._id;
    const schoolId = req.user.schoolId;

    const note = await Note.findOne({
      _id: id,
      teacherId,
      schoolId,
      isActive: true
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found or you are not authorized to update it'
      });
    }

    // Update note fields
    if (title) note.title = title;
    if (content) note.content = content;
    if (attachments) note.attachments = attachments;

    await note.save();

    // Populate the updated note
    await note.populate([
      { path: 'classId', select: 'name section' },
      { path: 'subjectId', select: 'name' },
      { path: 'teacherId', select: 'name email' }
    ]);

    // Get all students in the class to emit WebSocket events
    const students = await Student.find({ 
      classId: note.classId,
      schoolId: note.schoolId,
      status: 'active'
    });

    // Emit WebSocket event for note update
    if (io && students.length > 0) {
      console.log(`📝 Backend: Emitting note_updated event to ${students.length} students`);
      
      // Get all parents for these students
      const studentIds = students.map(s => s._id);
      const parents = await Parent.find({ studentId: { $in: studentIds } });
      
      // Emit to each student in the class
      students.forEach(student => {
        const roomName = `user_${student._id}`;
        io.to(roomName).emit('note_updated', {
          success: true,
          note: note.toObject(),
          message: `Note updated: ${note.title}`
        });
      });
      
      // Emit to each parent of students in the class
      parents.forEach(parent => {
        const parentRoomName = `user_${parent._id}`;
        io.to(parentRoomName).emit('note_updated', {
          success: true,
          note: note.toObject(),
          message: `Note updated for your child: ${note.title}`
        });
      });
    }

    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating note'
    });
  }
};

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private (Teacher - Note Creator)
const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user._id;
    const schoolId = req.user.schoolId;

    const note = await Note.findOne({
      _id: id,
      teacherId,
      schoolId,
      isActive: true
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found or you are not authorized to delete it'
      });
    }

    // Soft delete by setting isActive to false
    note.isActive = false;
    await note.save();

    // Get all students in the class to emit WebSocket events
    const students = await Student.find({ 
      classId: note.classId,
      schoolId: note.schoolId,
      status: 'active'
    });

    // Emit WebSocket event for note deletion
    if (io && students.length > 0) {
      console.log(`📝 Backend: Emitting note_deleted event to ${students.length} students`);
      
      // Get all parents for these students
      const studentIds = students.map(s => s._id);
      const parents = await Parent.find({ studentId: { $in: studentIds } });
      
      // Emit to each student in the class
      students.forEach(student => {
        const roomName = `user_${student._id}`;
        io.to(roomName).emit('note_deleted', {
          success: true,
          noteId: id,
          classId: note.classId,
          subjectId: note.subjectId,
          teacherId: teacherId,
          message: `Note deleted: ${note.title}`
        });
      });
      
      // Emit to each parent of students in the class
      parents.forEach(parent => {
        const parentRoomName = `user_${parent._id}`;
        io.to(parentRoomName).emit('note_deleted', {
          success: true,
          noteId: id,
          classId: note.classId,
          subjectId: note.subjectId,
          teacherId: teacherId,
          message: `Note deleted for your child: ${note.title}`
        });
      });
    }

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting note'
    });
  }
};

// @desc    Update note attachments
// @route   PUT /api/notes/:id/attachments
// @access  Private (Teacher)
const updateNoteAttachments = async (req, res) => {
  try {
    const { attachments } = req.body;
    const noteId = req.params.id;
    const teacherId = req.user._id;

    // Find the note and verify ownership
    const note = await Note.findOne({ _id: noteId, teacherId });
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found or not authorized'
      });
    }

    // Update attachments
    note.attachments = attachments || [];
    await note.save();

    // Populate the note with related data
    await note.populate([
      { path: 'classId', select: 'name section' },
      { path: 'subjectId', select: 'name' },
      { path: 'teacherId', select: 'name email' }
    ]);

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error updating note attachments:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating note attachments'
    });
  }
};

// @desc    Add attachments to existing note
// @route   POST /api/notes/:id/attachments
// @access  Private (Teacher)
const addNoteAttachments = async (req, res) => {
  try {
    const noteId = req.params.id;
    const teacherId = req.user._id;

    console.log('📥 Backend: Adding attachments to note:', noteId);
    console.log('📥 Backend: req.files details:', JSON.stringify(req.files, null, 2));

    // Find the note and verify ownership
    const note = await Note.findOne({ _id: noteId, teacherId });
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found or not authorized'
      });
    }

    // Prepare attachments from uploaded files (Local Storage)
    const fileAttachments = [];
    if (req.files && req.files.length > 0) {
      console.log('📎 Backend: Processing', req.files.length, 'files for note attachment');
      
      req.files.forEach((file, index) => {
        console.log(`📎 Backend: File ${index}:`, {
          originalname: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size
        });
        
        // Use local file path
        const fileUrl = `/uploads/documents/${file.filename}`;
        
        console.log(`📎 Backend: Local file URL: ${fileUrl}`);
        
        fileAttachments.push({
          fileName: file.originalname,
          fileUrl: fileUrl, // Local file URL
          fileType: 'pdf',
          fileSize: file.size
        });
      });
      
      console.log('📎 Backend: Prepared attachments array:', JSON.stringify(fileAttachments, null, 2));
    }

    // Add new attachments to existing ones
    if (fileAttachments.length > 0) {
      note.attachments = [...(note.attachments || []), ...fileAttachments];
      await note.save();
    }

    // Populate the note with related data
    await note.populate([
      { path: 'classId', select: 'name section' },
      { path: 'subjectId', select: 'name' },
      { path: 'teacherId', select: 'name email' }
    ]);

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error adding note attachments:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding note attachments'
    });
  }
};

module.exports = {
  createNote,
  getNotesForClassSubject,
  getNotesForTeacher,
  getNoteById,
  updateNote,
  deleteNote,
  setSocketIO,
  updateNoteAttachments,
  addNoteAttachments,
};
