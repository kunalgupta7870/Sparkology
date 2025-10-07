const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');
const Student = require('../models/Student');
const { validationResult } = require('express-validator');

// WebSocket instance (will be injected)
let io = null;

// Function to set WebSocket instance
const setSocketIO = (socketIO) => {
  io = socketIO;
};

// @desc    Send direct message between two users
// @route   POST /api/messages/direct
// @access  Private (Student, Teacher, Parent)
const sendDirectMessage = async (req, res) => {
  try {
    const { content, recipientId, recipientType, messageType = 'text', replyTo, attachments = [] } = req.body;
    const senderId = req.user._id;
    const schoolId = req.user.schoolId;
    
    // Determine sender model and display type based on role and parent type
    let senderModel;
    let senderDisplayType;
    
    if (req.user.role === 'student') {
      senderModel = 'Student';
      senderDisplayType = 'student';
    } else if (req.user.role === 'parent') {
      senderModel = 'Student'; // Parents are stored in Student collection
      // Use parent type as display type
      if (req.user.parentType === 'father') {
        senderDisplayType = 'father';
      } else if (req.user.parentType === 'mother') {
        senderDisplayType = 'mother';
      } else if (req.user.parentType === 'guardian') {
        senderDisplayType = 'guardian';
      } else {
        senderDisplayType = 'father'; // Default fallback
      }
    } else {
      senderModel = 'User'; // Teacher
      senderDisplayType = 'teacher';
    }
    
    const senderRole = req.user.role;
    
    // Determine recipient role
    const recipientRole = recipientType === 'teacher' ? 'teacher' : 
                         recipientType === 'student' ? 'student' : 'parent';

    // Validate input
    if (!content || !recipientId || !recipientType) {
      return res.status(400).json({
        success: false,
        error: 'Content, recipientId, and recipientType are required'
      });
    }

    // Validate recipient type based on sender role
    if (senderRole === 'student') {
      if (recipientType !== 'teacher') {
        return res.status(400).json({
          success: false,
          error: 'Students can only message teachers'
        });
      }
    } else if (senderRole === 'parent') {
      // Remove parent messaging capability - parents can no longer send messages
      return res.status(403).json({
        success: false,
        error: 'Parent messaging is not available'
      });
    } else if (senderRole === 'teacher') {
      if (recipientType !== 'student') {
        return res.status(400).json({
          success: false,
          error: 'Teachers can only message students'
        });
      }
    }

    // Verify recipient exists - only students are allowed as recipients for teachers
    let recipient;
    if (recipientType === 'teacher') {
      recipient = await User.findOne({ _id: recipientId, schoolId, role: 'teacher' });
    } else if (recipientType === 'student') {
      recipient = await Student.findOne({ _id: recipientId, schoolId });
    } else {
      // No other recipient types allowed
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient type'
      });
    }

    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: 'Recipient not found'
      });
    }

    // Create direct message (always without group)
    console.log(`📤 Backend: Creating direct message between ${senderId} and ${recipientId}`);
    
    // Determine recipient model and display type based on recipient type
    let recipientModel;
    let recipientDisplayType;
    
    if (recipientType === 'teacher') {
      recipientModel = 'User';
      recipientDisplayType = 'teacher';
    } else if (recipientType === 'student') {
      recipientModel = 'Student';
      recipientDisplayType = 'student';
    } else {
      // Only teacher and student recipients are allowed
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient type'
      });
    }
    
    // Parent messaging is no longer supported
    let parentType = null;
    
    console.log(`📤 Backend: Creating message with senderModel: ${senderModel}, senderDisplayType: ${senderDisplayType}, recipientModel: ${recipientModel}`);
    
    const message = await Message.create({
      content,
      sender: senderId,
      senderModel,
      senderDisplayType,
      senderRole,
      recipient: recipientId,
      recipientModel,
      recipientDisplayType,
      recipientRole,
      parentType,
      schoolId,
      messageType,
      replyTo: replyTo || null,
      attachments,
      readBy: [{
        user: senderId,
        userModel: senderModel,
        readAt: new Date()
      }]
    });
    
    // Emit WebSocket event for direct message
    if (io) {
      console.log(`📤 Backend: Emitting direct_message to recipient: ${recipientId}`);
      
      // Emit to sender
      io.to(`user_${senderId}`).emit('direct_message', {
        success: true,
        message: message,
        isOwn: true
      });
      
      // Emit to recipient
      io.to(`user_${recipientId}`).emit('direct_message', {
        success: true,
        message: message,
        isOwn: false
      });
    }

    // Populate sender information
    await message.populate('sender', 'name email role _id parentInfo');
    
    // If sender is a parent, update the sender info to show parent details
    if (message.senderRole === 'parent' && message.sender.parentInfo) {
      // Find which parent type this is based on the email
      const parentEmail = req.user.email;
      let parentName = 'Parent';
      
      if (message.sender.parentInfo.fatherEmail === parentEmail) {
        parentName = message.sender.parentInfo.fatherName;
      } else if (message.sender.parentInfo.motherEmail === parentEmail) {
        parentName = message.sender.parentInfo.motherName;
      } else if (message.sender.parentInfo.guardianEmail === parentEmail) {
        parentName = message.sender.parentInfo.guardianName;
      }
      
      // Update the sender object to show parent info
      message.sender.name = parentName;
      message.sender.email = parentEmail;
    }

    res.status(201).json({
      success: true,
      message: 'Direct message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('❌ Backend: Error sending direct message:', error);
    console.error('❌ Backend: Error details:', {
      message: error.message,
      stack: error.stack,
      senderModel,
      recipientModel,
      senderRole,
      recipientRole
    });
    res.status(500).json({
      success: false,
      error: 'Server error while sending direct message'
    });
  }
};

// @desc    Get direct messages between two users
// @route   GET /api/messages/direct/:recipientId
// @access  Private (Student, Teacher, Parent)
const getDirectMessages = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { page = 1, limit = 50, senderRole } = req.query;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;

    // Get direct messages and messages from 2-person groups between current user and recipient
    console.log(`📥 Backend: Getting direct messages between ${userId} and ${recipientId}, senderRole filter: ${senderRole}`);
    
    // First, find 2-person groups where both users are members
    const twoPersonGroups = await Group.find({
      schoolId,
      isActive: true,
      $expr: { $eq: [{ $add: [{ $size: "$members" }, { $size: "$students" }] }, 2] },
      $and: [
        {
          $or: [
            { 'members.user': userId },
            { 'students.student': userId }
          ]
        },
        {
          $or: [
            { 'members.user': recipientId },
            { 'students.student': recipientId }
          ]
        }
      ]
    }).select('_id');

    const groupIds = twoPersonGroups.map(group => group._id);
    
    // Build query conditions
    const queryConditions = {
      schoolId,
      $or: [
        // Direct messages sent by current user to recipient
        { sender: userId, recipient: recipientId },
        // Direct messages sent by recipient to current user
        { sender: recipientId, recipient: userId },
        // Group messages from 2-person groups where both are members
        {
          groupId: { $in: groupIds },
          $or: [
            { sender: userId },
            { sender: recipientId }
          ]
        }
      ]
    };

    // Add senderRole filter if specified (for separating parent vs student messages)
    if (senderRole) {
      queryConditions.senderRole = senderRole;
    }

    const messages = await Message.find(queryConditions)
    .populate('sender', 'name email role _id parentInfo')
    .populate('recipient', 'name email role')
    .populate('groupId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Update sender info for parent messages
    messages.forEach(message => {
      if (message.senderRole === 'parent' && message.sender.parentInfo) {
        // Find which parent type this is based on the sender ID
        // We need to determine which parent this is - this is tricky without the original email
        // For now, we'll use the first available parent info
        let parentName = 'Parent';
        let parentEmail = '';
        
        if (message.sender.parentInfo.fatherName) {
          parentName = message.sender.parentInfo.fatherName;
          parentEmail = message.sender.parentInfo.fatherEmail || '';
        } else if (message.sender.parentInfo.motherName) {
          parentName = message.sender.parentInfo.motherName;
          parentEmail = message.sender.parentInfo.motherEmail || '';
        } else if (message.sender.parentInfo.guardianName) {
          parentName = message.sender.parentInfo.guardianName;
          parentEmail = message.sender.parentInfo.guardianEmail || '';
        }
        
        // Update the sender object to show parent info
        message.sender.name = parentName;
        if (parentEmail) {
          message.sender.email = parentEmail;
        }
      }
    });

    const total = await Message.countDocuments({
      schoolId,
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId },
        {
          groupId: { $in: groupIds },
          $or: [
            { sender: userId },
            { sender: recipientId }
          ]
        }
      ]
    });

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      data: messages.reverse() // Reverse to show oldest first
    });

  } catch (error) {
    console.error('Get direct messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching direct messages'
    });
  }
};

// @desc    Send message to group
// @route   POST /api/messages
// @access  Private (Group Members)
const sendMessage = async (req, res) => {
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

    const { content, groupId, messageType = 'text', replyTo, attachments = [] } = req.body;
    const senderId = req.user._id;
    const schoolId = req.user.schoolId;
    const senderModel = req.user.role === 'student' ? 'Student' : 
                       req.user.role === 'parent' ? 'Student' : 'User';

    // Verify group exists and user has access
    const group = await Group.findOne({ 
      _id: groupId, 
      schoolId, 
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is member of the group
    const hasAccess = req.user.role === 'school_admin' || 
                     group.isMember(senderId) || 
                     group.isStudentMember(senderId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this group'
      });
    }

    // Check if students are allowed to send messages
    if (req.user.role === 'student' && !group.settings.allowStudentMessages) {
      return res.status(403).json({
        success: false,
        error: 'Students are not allowed to send messages in this group'
      });
    }

    // Create message
    const message = await Message.create({
      content,
      sender: senderId,
      senderModel,
      senderRole,
      groupId,
      schoolId,
      messageType,
      replyTo: replyTo || null,
      attachments,
      readBy: [{
        user: senderId,
        userModel: senderModel,
        readAt: new Date()
      }]
    });

    // Populate sender information
    await message.populate('sender', 'name email role _id');

    // Check if group has only 2 members and create duplicate direct messages
    const totalMembers = group.memberCount;
    if (totalMembers === 2) {
      console.log(`📤 Backend: Group has 2 members, creating duplicate direct messages`);
      
      // Find the other member (not the sender)
      let recipientId = null;
      let recipientModel = null;
      
      // Check if sender is in members array
      const senderInMembers = group.members.find(member => 
        member.user.toString() === senderId.toString()
      );
      
      if (senderInMembers) {
        // Sender is a teacher/parent, recipient is the other member
        const otherMember = group.members.find(member => 
          member.user.toString() !== senderId.toString()
        );
        if (otherMember) {
          recipientId = otherMember.user;
          recipientModel = 'User';
        }
      } else {
        // Sender is a student, recipient is the teacher
        if (group.members.length > 0) {
          recipientId = group.members[0].user;
          recipientModel = 'User';
        }
      }
      
      // Also check students array if no recipient found
      if (!recipientId) {
        const senderInStudents = group.students.find(student => 
          student.student.toString() === senderId.toString()
        );
        
        if (senderInStudents) {
          // Sender is a student, recipient is the teacher
          if (group.members.length > 0) {
            recipientId = group.members[0].user;
            recipientModel = 'User';
          }
        } else {
          // Sender is a teacher, recipient is the student
          if (group.students.length > 0) {
            recipientId = group.students[0].student;
            recipientModel = 'Student';
          }
        }
      }
      
      // Create duplicate direct messages if recipient found
      if (recipientId) {
        // Create direct message from sender to recipient
        const directMessage1 = await Message.create({
          content,
          sender: senderId,
          senderModel,
          senderRole,
          recipient: recipientId,
          recipientModel,
          recipientRole: 'student', // Assuming group members are students
          schoolId,
          messageType,
          replyTo: replyTo || null,
          attachments,
          readBy: [{
            user: senderId,
            userModel: senderModel,
            readAt: new Date()
          }]
        });
        
        // Populate sender information for direct message
        await directMessage1.populate('sender', 'name email role');
        
        console.log(`📤 Backend: Created direct message from ${senderId} to ${recipientId}`);
        
        // Emit direct message events
        if (io) {
          // Emit to sender
          io.to(`user_${senderId}`).emit('direct_message', {
            success: true,
            message: directMessage1,
            isOwn: true
          });
          
          // Emit to recipient
          io.to(`user_${recipientId}`).emit('direct_message', {
            success: true,
            message: directMessage1,
            isOwn: false
          });
        }
      }
    }

    // Emit WebSocket event if available
    if (io) {
      console.log(`📤 Backend: Emitting new_message to room: group_${groupId}`);
      console.log(`📤 Backend: Message content: ${message.content} from ${message.sender.name}`);
      io.to(`group_${groupId}`).emit('new_message', {
        success: true,
        message: message
      });
    } else {
      console.log('❌ Backend: WebSocket io instance not available');
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while sending message'
    });
  }
};

// @desc    Get messages for a group
// @route   GET /api/messages/group/:groupId
// @access  Private (Group Members)
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;

    // Verify group exists and user has access
    const group = await Group.findOne({ 
      _id: groupId, 
      schoolId, 
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is member of the group
    const hasAccess = req.user.role === 'school_admin' || 
                     group.isMember(userId) || 
                     group.isStudentMember(userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this group'
      });
    }

    // Get messages - include direct messages if group has only 2 members
    let messages = await Message.getGroupMessages(groupId, page, limit);
    
    // If group has only 2 members, also include direct messages between the two members
    if (group.memberCount === 2) {
      // Find the other member (not the current user)
      let otherMemberId = null;
      
      // Check if current user is in members array
      const userInMembers = group.members.find(member => 
        member.user.toString() === userId.toString()
      );
      
      if (userInMembers) {
        // Current user is a teacher/parent, other member is the other teacher/parent
        const otherMember = group.members.find(member => 
          member.user.toString() !== userId.toString()
        );
        if (otherMember) {
          otherMemberId = otherMember.user;
        }
      } else {
        // Current user is a student, other member is the teacher
        if (group.members.length > 0) {
          otherMemberId = group.members[0].user;
        }
      }
      
      // Also check students array if no other member found
      if (!otherMemberId) {
        const userInStudents = group.students.find(student => 
          student.student.toString() === userId.toString()
        );
        
        if (userInStudents) {
          // Current user is a student, other member is the teacher
          if (group.members.length > 0) {
            otherMemberId = group.members[0].user;
          }
        } else {
          // Current user is a teacher, other member is the student
          if (group.students.length > 0) {
            otherMemberId = group.students[0].student;
          }
        }
      }
      
      // Get direct messages between the two members if other member found
      if (otherMemberId) {
        const directMessages = await Message.find({
          schoolId,
          groupId: null, // Only direct messages (no group)
          $or: [
            { sender: userId, recipient: otherMemberId },
            { sender: otherMemberId, recipient: userId }
          ]
        })
        .populate('sender', 'name email role _id')
        .populate('recipient', 'name email role')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
        
        // Combine group messages and direct messages
        const allMessages = [...messages, ...directMessages];
        // Sort by creation date and take the limit
        messages = allMessages
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, limit * 1);
      }
    }

    // Get unread count for this user
    const unreadCount = await Message.getUnreadCount(
      groupId, 
      userId, 
      req.user.role === 'student' ? 'Student' : 'User'
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      unreadCount,
      data: messages.reverse() // Reverse to show oldest first
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching messages'
    });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/group/:groupId/read
// @access  Private (Group Members)
const markMessagesAsRead = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;
    const userModel = req.user.role === 'student' ? 'Student' : 'User';

    // Verify group exists and user has access
    const group = await Group.findOne({ 
      _id: groupId, 
      schoolId, 
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is member of the group
    const hasAccess = req.user.role === 'school_admin' || 
                     group.isMember(userId) || 
                     group.isStudentMember(userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this group'
      });
    }

    // Mark messages as read
    const result = await Message.markAsRead(groupId, userId, userModel);

    // Emit WebSocket event if available
    if (io) {
      io.to(`group_${groupId}`).emit('messages_read', {
        userId: userId,
        userName: req.user.name,
        groupId,
        readCount: result.modifiedCount
      });
    }

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking messages as read'
    });
  }
};

// @desc    Edit message
// @route   PUT /api/messages/:id
// @access  Private (Message Sender, Group Admin)
const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;

    // Find message
    const message = await Message.findOne({ 
      _id: id, 
      schoolId, 
      isDeleted: false 
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Check if user can edit this message
    const isSender = message.sender.toString() === userId.toString() && 
                    message.senderModel === (req.user.role === 'student' ? 'Student' : 'User');
    
    const group = await Group.findById(message.groupId);
    const isGroupAdmin = group && group.isAdmin(userId);

    if (!isSender && !isGroupAdmin && req.user.role !== 'school_admin') {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own messages'
      });
    }

    // Edit message
    await message.editMessage(content);

    res.status(200).json({
      success: true,
      message: 'Message edited successfully',
      data: message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while editing message'
    });
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private (Message Sender, Group Admin, School Admin)
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;

    // Find message
    const message = await Message.findOne({ 
      _id: id, 
      schoolId, 
      isDeleted: false 
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Check if user can delete this message
    const isSender = message.sender.toString() === userId.toString() && 
                    message.senderModel === (req.user.role === 'student' ? 'Student' : 'User');
    
    const group = await Group.findById(message.groupId);
    const isGroupAdmin = group && group.isAdmin(userId);

    if (!isSender && !isGroupAdmin && req.user.role !== 'school_admin') {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own messages'
      });
    }

    // Delete message
    await message.deleteMessage();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting message'
    });
  }
};

// @desc    Add reaction to message
// @route   POST /api/messages/:id/reaction
// @access  Private (Group Members)
const addReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;
    const userModel = req.user.role === 'student' ? 'Student' : 'User';

    // Find message
    const message = await Message.findOne({ 
      _id: id, 
      schoolId, 
      isDeleted: false 
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Verify group exists and user has access
    const group = await Group.findOne({ 
      _id: message.groupId, 
      schoolId, 
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is member of the group
    const hasAccess = req.user.role === 'school_admin' || 
                     group.isMember(userId) || 
                     group.isStudentMember(userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this group'
      });
    }

    // Add reaction
    await message.addReaction(userId, userModel, emoji);

    res.status(200).json({
      success: true,
      message: 'Reaction added successfully',
      data: message
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding reaction'
    });
  }
};

// @desc    Remove reaction from message
// @route   DELETE /api/messages/:id/reaction
// @access  Private (Group Members)
const removeReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const schoolId = req.user.schoolId;
    const userModel = req.user.role === 'student' ? 'Student' : 'User';

    // Find message
    const message = await Message.findOne({ 
      _id: id, 
      schoolId, 
      isDeleted: false 
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Verify group exists and user has access
    const group = await Group.findOne({ 
      _id: message.groupId, 
      schoolId, 
      isActive: true 
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if user is member of the group
    const hasAccess = req.user.role === 'school_admin' || 
                     group.isMember(userId) || 
                     group.isStudentMember(userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this group'
      });
    }

    // Remove reaction
    await message.removeReaction(userId, userModel);

    res.status(200).json({
      success: true,
      message: 'Reaction removed successfully',
      data: message
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while removing reaction'
    });
  }
};

// @desc    Get unread message counts for all groups
// @route   GET /api/messages/unread-counts
// @access  Private (Teacher, Student)
const getUnreadCounts = async (req, res) => {
  try {
    const userId = req.user._id;
    const schoolId = req.user.schoolId;
    const userModel = (req.user.role === 'student' || req.user.role === 'parent') ? 'Student' : 'User';

    // Get user's groups
    let groups;
    if (req.user.role === 'student' || req.user.role === 'parent') {
      groups = await Group.find({
        schoolId,
        isActive: true,
        'students.student': userId
      }).select('_id name');
    } else {
      groups = await Group.find({
        schoolId,
        isActive: true,
        $or: [
          { createdBy: userId },
          { 'members.user': userId }
        ]
      }).select('_id name');
    }

    // Get unread counts for each group
    const groupUnreadCounts = {};
    for (const group of groups) {
      const count = await Message.getUnreadCount(group._id, userId, userModel);
      groupUnreadCounts[group._id] = {
        groupId: group._id,
        groupName: group.name,
        unreadCount: count
      };
    }

    // Get direct message unread counts
    const directUnreadCounts = {};
    
    // For teachers, get unread counts from all students
    if (req.user.role === 'teacher') {
      const students = await Student.find({ schoolId, isActive: true }).select('_id name');
      
      for (const student of students) {
        const unreadCount = await Message.countDocuments({
          type: 'direct',
          recipient: userId,
          sender: student._id,
          'readBy.user': { $ne: userId }
        });
        
        if (unreadCount > 0) {
          directUnreadCounts[student._id] = {
            contactId: student._id,
            contactName: student.name,
            contactType: 'student',
            unreadCount: unreadCount
          };
        }
      }
    }
    
    // For students, get unread counts from teachers
    else if (req.user.role === 'student') {
      const teachers = await User.find({ 
        schoolId, 
        role: 'teacher',
        isActive: true 
      }).select('_id name');
      
      for (const teacher of teachers) {
        const unreadCount = await Message.countDocuments({
          type: 'direct',
          recipient: userId,
          sender: teacher._id,
          'readBy.user': { $ne: userId }
        });
        
        if (unreadCount > 0) {
          directUnreadCounts[teacher._id] = {
            contactId: teacher._id,
            contactName: teacher.name,
            contactType: 'teacher',
            unreadCount: unreadCount
          };
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        groups: groupUnreadCounts,
        directMessages: directUnreadCounts,
        total: Object.values(groupUnreadCounts).reduce((sum, group) => sum + group.unreadCount, 0) +
               Object.values(directUnreadCounts).reduce((sum, contact) => sum + contact.unreadCount, 0)
      }
    });
  } catch (error) {
    console.error('Get unread counts error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching unread counts'
    });
  }
};

// @desc    Mark direct messages from a contact as read
// @route   PUT /api/messages/direct/:contactId/read
// @access  Private
const markDirectMessagesAsRead = async (req, res) => {
  try {
    const contactId = req.params.contactId;
    const userId = req.user._id;
    const userModel = req.user.role === 'student' ? 'Student' : 'User';
    
    // Find all unread direct messages from this contact
    const unreadMessages = await Message.find({
      type: 'direct',
      sender: contactId,
      recipient: userId,
      'readBy.user': { $ne: userId }
    });
    
    // Mark each message as read by adding the user to readBy array
    let modifiedCount = 0;
    for (const message of unreadMessages) {
      const isAlreadyRead = message.readBy.some(readEntry => 
        readEntry.user.toString() === userId.toString()
      );
      
      if (!isAlreadyRead) {
        message.readBy.push({
          user: userId,
          userModel: userModel,
          readAt: new Date()
        });
        await message.save();
        modifiedCount++;
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        modifiedCount: modifiedCount,
        message: 'Messages marked as read'
      }
    });
  } catch (error) {
    console.error('Mark direct messages as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking messages as read'
    });
  }
};

module.exports = {
  sendDirectMessage,
  getDirectMessages,
  sendMessage,
  getGroupMessages,
  markMessagesAsRead,
  markDirectMessagesAsRead,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  getUnreadCounts,
  setSocketIO
};
