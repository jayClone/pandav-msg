import { SOCKET_EVENTS } from "../constant/response.messages.js";
import { handlePrivateMessage } from './handlers/private-message.handler.js';
import { handleJoinGroup, handleLeaveGroup } from './handlers/group-room.handler.js';
import { handleGroupMessage } from './handlers/group-message.handler.js';
import { handleUserConnect, handleUserDisconnect } from './handlers/user-status.handler.js';
import { handleReadReceipt } from './handlers/read-receipt.handler.js';

/**
 * Register all socket events
 * ✅ onlineUsers passed from socket.server.js
 */
export function registerSocketEvents(io, socket, onlineUsers) {
  const { userId, email, name } = socket.user;  // ✅ Get from socket.user

  console.log(`\n🟢 ================================`);
  console.log(`👤 User Connected: ${name}`);
  console.log(`   ID: ${userId}`);
  console.log(`   Socket: ${socket.id}`);
  console.log(`🟢 ================================\n`);

  // ✅ Pass onlineUsers to handlers
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
    } catch (error) {
      console.error("❌ Error leaving group:", error.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ GROUP MESSAGE - ⚠️ THIS WAS MISSING THE HANDLER CALL!
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.GROUP_MESSAGE, async (payload) => {
    console.log(`\n📥 [SOCKET] Received GROUP_MESSAGE from ${name}`);
    try {
      await handleGroupMessage(socket, io, payload, userId, name);
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
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ✅ READ RECEIPT
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.READ_RECEIPT, async (payload) => {
    console.log(`\n📥 [SOCKET EVENT] READ_RECEIPT received`);
    console.log(`   From: ${name}`);
    console.log(`   Payload:`, payload);
    
    try {
      await handleReadReceipt(socket, io, payload, userId, name);
    } catch (error) {
      console.error('❌ Error in read receipt handler:', error.message);
      socket.emit('error', { message: 'Failed to process read receipt' });
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