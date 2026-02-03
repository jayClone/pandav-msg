import { SOCKET_EVENTS } from "@constants/response.messages.js";
import { handlePrivateMessage } from './handlers/private-message.handler.js';
import { handleJoinGroup, handleLeaveGroup } from './handlers/group-room.handler.js';
import { handleGroupMessage } from './handlers/group-message.handler.js';
import { handleUserConnect, handleUserDisconnect } from './handlers/user-status.handler.js';
import Message from '@models/Message.js';

const onlineUsers = new Map();

/**
 * Register all socket events
 * ✅ Uses SOCKET_EVENTS constants - NO more case confusion!
 */
export function registerSocketEvents(io, socket) {
  const { userId, email, name } = socket.user;

  console.log(`\n🟢 ================================`);
  console.log(`👤 User Connected: ${name}`);
  console.log(`   ID: ${userId}`);
  console.log(`   Socket: ${socket.id}`);
  console.log(`🟢 ================================\n`);

  // ✅ User connected
  handleUserConnect(socket, io, userId, email, name, onlineUsers);

  // ═══════════════════════════════════════════════════════════════════
  // ✅ PRIVATE MESSAGE
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, async (data, callback) => {
    console.log("📥 [SOCKET] Received PRIVATE_MESSAGE:", { 
      toUserId: data.toUserId, 
      uniqueId: data.uniqueId 
    });
    
    try {
      const result = await handlePrivateMessage(socket, io, data, userId, name, onlineUsers);
      
      if (callback && typeof callback === 'function') {
        callback(null, {
          success: true,
          _id: result?._id,
          uniqueId: data.uniqueId,
          delivered: result?.delivered || true,
          message: "Message sent successfully"
        });
      }
    } catch (error) {
      console.error("❌ [SOCKET] Error handling private message:", error.message);
      if (callback && typeof callback === 'function') {
        callback(error.message);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ JOIN GROUP - Using SOCKET_EVENTS.JOIN_GROUP
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.JOIN_GROUP, async (payload) => {
    console.log(`📥 [SOCKET] Received JOIN_GROUP from ${name}:`, payload);
    
    try {
      handleJoinGroup(socket, io, payload, userId, name);
      console.log(`✅ User ${name} joined group`);
    } catch (error) {
      console.error("❌ Error joining group:", error.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ LEAVE GROUP - Using SOCKET_EVENTS.LEAVE_GROUP
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.LEAVE_GROUP, async (payload) => {
    console.log(`📥 [SOCKET] Received LEAVE_GROUP from ${name}:`, payload);
    
    try {
      handleLeaveGroup(socket, io, payload, userId, name);
      console.log(`✅ User ${name} left group`);
    } catch (error) {
      console.error("❌ Error leaving group:", error.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ GROUP MESSAGE - ⚠️ THIS WAS MISSING THE HANDLER CALL!
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.GROUP_MESSAGE, async (payload) => {
    console.log(`\n📥 [SOCKET] Received GROUP_MESSAGE from ${name}`);
    console.log(`   Payload:`, payload);
    
    try {
      // ✅ IMPORTANT: Actually call the handler!
      await handleGroupMessage(socket, io, payload, userId, name);
      console.log(`✅ GROUP_MESSAGE processed successfully\n`);
    } catch (error) {
      console.error("❌ [SOCKET] Error handling group message:", error.message);
      socket.emit('error', { message: 'Failed to send group message' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ TYPING
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.TYPING, (data) => {
    console.log(`📥 [SOCKET] Received TYPING from ${name}:`, { 
      toUserId: data.toUserId, 
      isTyping: data.isTyping 
    });
    
    const receiverUser = onlineUsers.get(data.toUserId);
    
    if (receiverUser) {
      console.log(`📤 [SOCKET] Sending TYPING to ${receiverUser.name}`);
      io.to(receiverUser.socketId).emit(SOCKET_EVENTS.TYPING, {
        fromUserId: userId,
        isTyping: data.isTyping
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ MESSAGE DELETED
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (data) => {
    console.log(`📥 [SOCKET] Received MESSAGE_DELETED from ${name}:`, data);
    
    const receiverUser = onlineUsers.get(data.toUserId);
    
    if (receiverUser) {
      console.log(`📤 [SOCKET] Sending MESSAGE_DELETED to ${receiverUser.name}`);
      io.to(receiverUser.socketId).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
        messageId: data.messageId,
        fromUserId: userId,
        toUserId: data.toUserId
      });
    } else {
      console.log(`⚠️ [SOCKET] Receiver ${data.toUserId} offline`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ READ RECEIPT
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.READ_RECEIPT, async (data) => {
    console.log(`📥 [SOCKET] Received READ_RECEIPT from ${name}:`, data);

    const { messageId, senderId, receiverId } = data;
    
    try {
      // ✅ Update message in DB as read
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { read: true },
        { new: true }
      );
      console.log(`✅ [DB] Message ${messageId} marked as read in database`);

      // ✅ Find original sender
      const originalSender = onlineUsers.get(senderId);
      
      if (originalSender) {
        // ✅ Send MESSAGE_READ to sender
        io.to(originalSender.socketId).emit(SOCKET_EVENTS.MESSAGE_READ, {
          messageId: messageId,
          readBy: userId,
          senderId: senderId,
          readerName: name
        });
        console.log(`✅ [SOCKET] MESSAGE_READ sent to sender ${originalSender.name}`);
      } else {
        console.log(`⚠️ [SOCKET] Sender ${senderId} is offline`);
      }
    } catch (err) {
      console.error(`❌ [ERROR] Failed to mark message as read:`, err.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ DISCONNECT
  // ═══════════════════════════════════════════════════════════════════
  socket.on("disconnect", async () => {
    try {
      handleUserDisconnect(socket, io, userId, name, onlineUsers);
    } catch (error) {
      console.error("❌ Error handling disconnect:", error.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════
  socket.on("error", (error) => {
    console.error(`⚠️ [SOCKET] Error from ${name}:`, error);
  });
}