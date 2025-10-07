const Message = require('../models/Message');
const Group = require('../models/Group');

const socketHandler = (io, socket) => {
  console.log(`🔌 User connected: ${socket.user.name} (${socket.userRole})`);

  // Automatically join user to their personal room for direct messages and assignments
  const userRoom = `user_${socket.userId}`;
  socket.join(userRoom);
  console.log(`👤 ${socket.user.name} (${socket.userRole}) automatically joined personal room: ${userRoom}`);
  console.log(`👤 User ID: ${socket.userId}, School ID: ${socket.schoolId}`);
  
  // Join school admin users and parents to their school room for real-time updates
  if (socket.userRole === 'school_admin' || socket.userRole === 'parent') {
    const schoolRoom = `school_${socket.schoolId}`;
    socket.join(schoolRoom);
    console.log(`🏫 ${socket.user.name} (${socket.userRole}) joined school room: ${schoolRoom}`);
  }

  // For students, join their class room for notes and assignments
  if (socket.userRole === 'student' && socket.user.classId) {
    const classRoom = `class_${socket.user.classId}`;
    socket.join(classRoom);
    console.log(`🎓 ${socket.user.name} (student) joined class room: ${classRoom}`);
  }
  
  // For parents, also join their child's room to receive child-specific events
  if (socket.userRole === 'parent' && socket.user.studentId) {
    const childRoom = `user_${socket.user.studentId}`;
    socket.join(childRoom);
    console.log(`👨‍👩‍👧‍👦 Parent ${socket.user.name} also joined child's room: ${childRoom}`);
    console.log(`👨‍👩‍👧‍👦 Parent studentId: ${socket.user.studentId}`);
  }

  // Join user to their groups and user room for direct messages
  socket.on('join_groups', async () => {
    try {
      // Join user's personal room for direct messages
      socket.join(`user_${socket.userId}`);
      console.log(`👤 ${socket.user.name} joined personal room: user_${socket.userId}`);

      let groups;
      if (socket.userRole === 'student') {
        groups = await Group.find({
          schoolId: socket.schoolId,
          isActive: true,
          'students.student': socket.userId
        }).select('_id name');
      } else {
        groups = await Group.find({
          schoolId: socket.schoolId,
          isActive: true,
          $or: [
            { createdBy: socket.userId },
            { 'members.user': socket.userId }
          ]
        }).select('_id name');
      }

      groups.forEach(group => {
        socket.join(`group_${group._id}`);
        console.log(`👥 ${socket.user.name} joined group: ${group.name}`);
      });

      socket.emit('groups_joined', { 
        success: true, 
        groups: groups.map(g => ({ id: g._id, name: g.name }))
      });
    } catch (error) {
      console.error('Error joining groups:', error);
      socket.emit('error', { message: 'Failed to join groups' });
    }
  });

  // Join specific group
  socket.on('join_group', async (data) => {
    try {
      const { groupId } = data;
      console.log(`🔌 Backend: ${socket.user.name} (${socket.userRole}) trying to join group: ${groupId}`);
      
      // Verify user has access to this group
      const group = await Group.findOne({
        _id: groupId,
        schoolId: socket.schoolId,
        isActive: true
      });

      if (!group) {
        console.log(`❌ Backend: Group ${groupId} not found for user ${socket.user.name}`);
        socket.emit('error', { message: 'Group not found' });
        return;
      }

      console.log(`✅ Backend: Found group: ${group.name} (type: ${group.type})`);

      // Check if user is member of the group
      const hasAccess = socket.userRole === 'school_admin' || 
                       group.isMember(socket.userId) || 
                       group.isStudentMember(socket.userId);

      console.log(`🔍 Backend: User access check - role: ${socket.userRole}, isMember: ${group.isMember(socket.userId)}, isStudentMember: ${group.isStudentMember(socket.userId)}, hasAccess: ${hasAccess}`);

      if (!hasAccess) {
        console.log(`❌ Backend: User ${socket.user.name} denied access to group ${group.name}`);
        socket.emit('error', { message: 'You are not a member of this group' });
        return;
      }

      socket.join(`group_${groupId}`);
      console.log(`👥 Backend: ${socket.user.name} successfully joined group: ${group.name} (room: group_${groupId})`);
      
      socket.emit('group_joined', { 
        success: true, 
        groupId,
        groupName: group.name
      });
    } catch (error) {
      console.error('❌ Backend: Error joining group:', error);
      socket.emit('error', { message: 'Failed to join group' });
    }
  });

  // Leave group
  socket.on('leave_group', (data) => {
    const { groupId } = data;
    socket.leave(`group_${groupId}`);
    console.log(`👋 ${socket.user.name} left group: ${groupId}`);
    socket.emit('group_left', { success: true, groupId });
  });

  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { content, groupId, messageType = 'text', replyTo } = data;

      // Verify group exists and user has access
      const group = await Group.findOne({
        _id: groupId,
        schoolId: socket.schoolId,
        isActive: true
      });

      if (!group) {
        socket.emit('error', { message: 'Group not found' });
        return;
      }

      // Check if user is member of the group
      const hasAccess = socket.userRole === 'school_admin' || 
                       group.isMember(socket.userId) || 
                       group.isStudentMember(socket.userId);

      if (!hasAccess) {
        socket.emit('error', { message: 'You are not a member of this group' });
        return;
      }

      // Check if students are allowed to send messages
      if (socket.userRole === 'student' && !group.settings.allowStudentMessages) {
        socket.emit('error', { message: 'Students are not allowed to send messages in this group' });
        return;
      }

      // Create message
      const message = await Message.create({
        content,
        sender: socket.userId,
        senderModel: socket.userRole === 'student' ? 'Student' : 
                    socket.userRole === 'parent' ? 'Student' : 'User',
        groupId,
        schoolId: socket.schoolId,
        messageType,
        replyTo: replyTo || null,
        readBy: [{
          user: socket.userId,
          userModel: socket.userRole === 'student' ? 'Student' : 
                    socket.userRole === 'parent' ? 'Student' : 'User',
          readAt: new Date()
        }]
      });

      // Populate sender information
      await message.populate('sender', 'name email role _id');

      // Check if group has only 2 members and create duplicate direct messages
      const totalMembers = group.memberCount;
      if (totalMembers === 2) {
        console.log(`📤 Socket: Group has 2 members, creating duplicate direct messages`);
        
        // Find the other member (not the sender)
        let recipientId = null;
        let recipientModel = null;
        
        // Check if sender is in members array
        const senderInMembers = group.members.find(member => 
          member.user.toString() === socket.userId.toString()
        );
        
        if (senderInMembers) {
          // Sender is a teacher/parent, recipient is the other member
          const otherMember = group.members.find(member => 
            member.user.toString() !== socket.userId.toString()
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
            student.student.toString() === socket.userId.toString()
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
            sender: socket.userId,
            senderModel: socket.userRole === 'student' ? 'Student' : 
                    socket.userRole === 'parent' ? 'Student' : 'User',
            recipient: recipientId,
            recipientModel,
            schoolId: socket.schoolId,
            messageType,
            replyTo: replyTo || null,
            readBy: [{
              user: socket.userId,
              userModel: socket.userRole === 'student' ? 'Student' : 
                    socket.userRole === 'parent' ? 'Student' : 'User',
              readAt: new Date()
            }]
          });
          
          // Populate sender information for direct message
          await directMessage1.populate('sender', 'name email role');
          
          console.log(`📤 Socket: Created direct message from ${socket.userId} to ${recipientId}`);
          
          // Emit direct message events
          // Emit to sender
          io.to(`user_${socket.userId}`).emit('direct_message', {
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

      // Emit message to all group members
      io.to(`group_${groupId}`).emit('new_message', {
        success: true,
        message: message
      });

      console.log(`💬 ${socket.user.name} sent message to group ${group.name}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Mark messages as read
  socket.on('mark_messages_read', async (data) => {
    try {
      const { groupId } = data;

      // Verify group exists and user has access
      const group = await Group.findOne({
        _id: groupId,
        schoolId: socket.schoolId,
        isActive: true
      });

      if (!group) {
        socket.emit('error', { message: 'Group not found' });
        return;
      }

      // Check if user is member of the group
      const hasAccess = socket.userRole === 'school_admin' || 
                       group.isMember(socket.userId) || 
                       group.isStudentMember(socket.userId);

      if (!hasAccess) {
        socket.emit('error', { message: 'You are not a member of this group' });
        return;
      }

      // Mark messages as read
      const result = await Message.markAsRead(
        groupId, 
        socket.userId, 
        socket.userRole === 'student' ? 'Student' : 
        socket.userRole === 'parent' ? 'Student' : 'User'
      );

      // Notify other group members that messages were read
      socket.to(`group_${groupId}`).emit('messages_read', {
        userId: socket.userId,
        userName: socket.user.name,
        groupId,
        readCount: result.modifiedCount
      });

      socket.emit('messages_marked_read', { 
        success: true, 
        groupId,
        readCount: result.modifiedCount
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });

  // Direct message handler
  socket.on('send_direct_message', async (data) => {
    try {
      const { content, recipientId, recipientType, messageType = 'text', replyTo } = data;
      
      console.log(`📤 Socket: Direct message from ${socket.userId} to ${recipientId}: ${content}`);
      console.log(`📤 Socket: User role: ${socket.userRole}, User name: ${socket.user.name}`);
      
      // Create direct message
      const Message = require('../models/Message');
      
      // Determine sender model and display type based on role and parent type
      let senderModel;
      let senderDisplayType;
      
      if (socket.userRole === 'student') {
        senderModel = 'Student';
        senderDisplayType = 'student';
      } else if (socket.userRole === 'parent') {
        // Parent messaging is no longer supported
        socket.emit('error', { message: 'Parent messaging is not available' });
        return;
      } else {
        senderModel = 'User'; // Teacher
        senderDisplayType = 'teacher';
      }
      
      const recipientRole = recipientType === 'teacher' ? 'teacher' : 
                           recipientType === 'student' ? 'student' : null;
      
      // Only teacher and student recipients are allowed
      if (!recipientRole) {
        socket.emit('error', { message: 'Invalid recipient type' });
        return;
      }
      
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
        socket.emit('error', { message: 'Invalid recipient type' });
        return;
      }
      
      // Parent messaging is no longer supported
      let parentType = null;
      
      console.log(`📤 Socket: Creating message with senderModel: ${senderModel}, senderDisplayType: ${senderDisplayType}, recipientModel: ${recipientModel}`);
      
      const message = await Message.create({
        content,
        sender: socket.userId,
        senderModel,
        senderDisplayType,
        senderRole: socket.userRole,
        recipient: recipientId,
        recipientModel,
        recipientDisplayType,
        recipientRole,
        parentType,
        schoolId: socket.schoolId,
        messageType,
        replyTo: replyTo || null,
        readBy: [{
          user: socket.userId,
          userModel: senderModel,
          readAt: new Date()
        }]
      });
      
      console.log(`📤 Socket: Message created with senderRole: ${message.senderRole}, senderModel: ${message.senderModel}`);
      
      // Populate sender information
      await message.populate('sender', 'name email role _id parentInfo');
      
      // If sender is a parent, update the sender info to show parent details
      if (message.senderRole === 'parent' && message.sender.parentInfo) {
        // Find which parent type this is based on the email
        const parentEmail = socket.user.email;
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
      
      console.log(`✅ Socket: Direct message created: ${message._id}`);
      
      // Emit to sender
      io.to(`user_${socket.userId}`).emit('direct_message', {
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
      
      console.log(`📤 Socket: Direct message sent to both users`);
      
    } catch (error) {
      console.error('❌ Socket: Error sending direct message:', error);
      console.error('❌ Socket: Error details:', {
        message: error.message,
        stack: error.stack,
        senderModel,
        recipientModel,
        senderRole: socket.userRole,
        recipientRole
      });
      socket.emit('error', { message: 'Failed to send direct message' });
    }
  });

  // Typing indicator
  socket.on('typing_start', (data) => {
    const { groupId } = data;
    socket.to(`group_${groupId}`).emit('user_typing', {
      userId: socket.userId,
      userName: socket.user.name,
      groupId
    });
  });

  socket.on('typing_stop', (data) => {
    const { groupId } = data;
    socket.to(`group_${groupId}`).emit('user_stopped_typing', {
      userId: socket.userId,
      userName: socket.user.name,
      groupId
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.user.name} (${socket.userRole})`);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.user.name}:`, error);
  });
};

module.exports = socketHandler;
