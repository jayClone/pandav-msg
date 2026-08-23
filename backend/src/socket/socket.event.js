import { SOCKET_EVENTS } from "../constant/response.messages.js";
import { handlePrivateMessage } from './handlers/private-message.handler.js';
import { handleJoinGroup, handleLeaveGroup } from './handlers/group-room.handler.js';
import { handleGroupMessage } from './handlers/group-message.handler.js';
import { handleUserConnect, handleUserDisconnect } from './handlers/user-status.handler.js';
import { handleReadReceipt } from './handlers/read-receipt.handler.js';
import { handleTyping } from './handlers/typing.handler.js';
import { handleMessageDeleted } from './handlers/message-deleted.handler.js';
import { handleMessageReaction } from './handlers/reaction.handler.js';

/**
 * Register all socket events
 * ✅ onlineUsers passed from socket.server.js
 */
export function registerSocketEvents(io, socket, onlineUsers) {
  const { userId, email, name } = socket.user; 

  handleUserConnect(socket, io, userId, email, name, onlineUsers);

  // ═══════════════════════════════════════════════════════════════════
  // ✅ PRIVATE MESSAGE
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, async (data, callback) => {
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
      console.error(" [SOCKET] Error handling private message:", error.message);
      if (callback && typeof callback === 'function') {
        callback(error.message);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  JOIN GROUP - Using SOCKET_EVENTS.JOIN_GROUP
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.JOIN_GROUP, async (payload) => {
    try {
      handleJoinGroup(socket, io, payload, userId, name);
    } catch (error) {
      console.error(" Error joining group:", error.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  LEAVE GROUP - Using SOCKET_EVENTS.LEAVE_GROUP
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.LEAVE_GROUP, async (payload) => {
    try {
      handleLeaveGroup(socket, io, payload, userId, name);
    } catch (error) {
      console.error(" Error leaving group:", error.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  GROUP MESSAGE -  THIS WAS MISSING THE HANDLER CALL!
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.GROUP_MESSAGE, async (payload) => {
    try {
      await handleGroupMessage(socket, io, payload, userId, name);
    } catch (error) {
      console.error(" [SOCKET] Error handling group message:", error.message);
      socket.emit('error', { message: 'Failed to send group message' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  TYPING
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.TYPING, (data) => {
    handleTyping(socket, io, data, userId, onlineUsers);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  MESSAGE DELETED
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (data) => {
    handleMessageDeleted(socket, io, data, userId, onlineUsers);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  MESSAGE REACTION
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.MESSAGE_REACTION, (data) => {
    handleMessageReaction(socket, io, data, userId);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  READ RECEIPT
  // ═══════════════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.READ_RECEIPT, async (payload) => {
    try {
      await handleReadReceipt(socket, io, payload, userId, name);
    } catch (error) {
      console.error(' [SOCKET] Error in read receipt handler:', error.message);
      socket.emit('error', { message: 'Failed to process read receipt' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  DISCONNECT
  // ═══════════════════════════════════════════════════════════════════
  socket.on("disconnect", async () => {
    try {
      handleUserDisconnect(socket, io, userId, name, onlineUsers);
    } catch (error) {
      console.error(" Error handling disconnect:", error.message);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════
  socket.on("error", (error) => {
    console.error(` [SOCKET] Error from ${name}:`, error);
  });
}