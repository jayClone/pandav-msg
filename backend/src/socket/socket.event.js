import { MESSAGES, SOCKET_EVENTS } from "../constant/response.messages.js";
import Message from '@models/Message.js';
import User from '@models/User.js';

const onlineUsers = new Map();

/**
 * Register all socket events
 * Handles: messaging, online status, disconnection
 */
export function registerSocketEvents(io, socket) {
    const { userId, email, name } = socket.user;

    console.log(`[SOCKET] User connected: ${name} (${userId})`);

    // Store user in online users map
    onlineUsers.set(userId, {
        socketId: socket.id,
        name: name,
        email: email,
        userId: userId
    });
    
    // Broadcast updated online users list
    broadcastOnlineUsers(io);
    console.log(`[SOCKET] Connected: ${name} (${userId}) -> ${socket.id}`);

    /**
     * PRIVATE_MESSAGE Event Handler
     * 1. Validate input
     * 2. Save to DB
     * 3. Send real-time notification
     * 4. Send confirmation to sender
     */

    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, async (data) => {
        const { toUserId, message } = data; // ✅ No need for tempId

        try {
            // Validation Layer
            if (!toUserId || typeof toUserId !== "string") {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: MESSAGES.SOCKET.TO_USER_REQUIRED 
                });
                return;
            }
            
            if (!message || typeof message !== "string" || message.trim().length === 0) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: MESSAGES.SOCKET.MESSAGE_EMPTY 
                });
                return;
            }

            const trimmedMessage = message.trim();
            const receiverUser = onlineUsers.get(toUserId);

            // now were gonna save message here for mongo
            let savedMessage;
            try {
                savedMessage = await Message.create({
                    senderId: userId,
                    receiverId: toUserId,
                    message: trimmedMessage
                });
                console.log(`[DB] Message saved: ${savedMessage._id}`);
            } catch (dbError) {
                console.error('[DB ERROR] Failed to save message:', dbError.message);
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: 'Failed to save message'
            });
            return;
        }
            const messagePayload = {
                _id: savedMessage._id,
                fromUserId: userId,
                toUserId: toUserId,
                fromUserName: name,
                message: trimmedMessage,
                time: savedMessage.createdAt.toISOString(),
                delivered: false // stay  false as message is not delivered
            };

            // if reciver is online : send real-time notification
            if (receiverUser) {
                io.to(receiverUser.socketId).emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
                    ...messagePayload,
                    delivered: true // status get true as message is delivered
                });
                console.log(`[MSG-LIVE] ${name} → ${receiverUser.name}: ${trimmedMessage.substring(0, 30)}...`);
            }
            else{
                // If receiver is OFFLINE: Still saved in DB, will show in history
                console.log(`[MSG-QUEUED] ${name} → ${toUserId} (offline): ${trimmedMessage.substring(0, 30)}...`);
                
                // Send offline notification if receiver not online
                socket.emit('user_offline', {
                    toUserId: toUserId,
                    message: 'User is offline. Message queued for delivery.'
                });
                console.log(`[OFFLINE] ${toUserId} is offline`);
            }

            // send confirmation back to sender
            socket.emit(SOCKET_EVENTS.MESSAGE_SENT,{
            _id: savedMessage._id,  // ✅ Add _id
            fromUserId: userId,     // ✅ Add fromUserId
            toUserId: toUserId,     // ✅ Keep toUserId
            fromUserName: name,     // ✅ Add fromUserName
            message: trimmedMessage,
            time: savedMessage.createdAt.toISOString(),
            tempId: tempId,  // ✅ Send back tempId
            delivered: !!receiverUser,
            saved: true
            });

            console.log(`[CONFIRM] Sent confirmation to ${name}`);

        } catch (error) {
            console.error('[ERROR] Message sending failed:', error.message);
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: MESSAGES.SOCKET.SOMETHING_WENT_WRONG 
            });
        }
    });

    // ✅ Handle message deletion
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (data) => {
      console.log("📥 [SOCKET] Received MESSAGE_DELETED event:", data)
      console.log("📥 [SOCKET] Current userId:", userId)
      console.log("📥 [SOCKET] Online users map:", Array.from(onlineUsers.entries()))
      
      const receiverUser = onlineUsers.get(data.toUserId)
      console.log("📥 [SOCKET] Receiver user found:", receiverUser)
      
      if (receiverUser) {
        console.log(`📤 [SOCKET] Sending to receiver ${receiverUser.name} (socket: ${receiverUser.socketId})`)
        io.to(receiverUser.socketId).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
          messageId: data.messageId,
          fromUserId: userId,
          toUserId: data.toUserId
        })
      } else {
        console.log(`⚠️ [SOCKET] Receiver ${data.toUserId} NOT found in online users`)
      }
    })

    /**
     * DISCONNECT Event Handler
     * Clean up user from online map
     */
    socket.on("disconnect", () => {
        onlineUsers.delete(userId);
        broadcastOnlineUsers(io);
        console.log(`[SOCKET] Disconnected: ${name} (${userId})`);
    });

    console.log("⚠️ [SOCKET EVENTS REGISTERED]:", Object.keys({
      [SOCKET_EVENTS.PRIVATE_MESSAGE]: true,
      [SOCKET_EVENTS.MESSAGE_DELETED]: true,
      [SOCKET_EVENTS.DISCONNECT]: true
    }))
}

/**
 * Helper: Broadcast online users to all connected clients
 */
function broadcastOnlineUsers(io) {
    const onlineUsersList = Array.from(onlineUsers.values()).map(user => ({
        userId: user.userId,
        name: user.name,
        email: user.email,
        status: 'online'
    }));
    io.emit(SOCKET_EVENTS.ONLINE_USERS, onlineUsersList);
    console.log(`[BROADCAST] Online users: ${onlineUsersList.length}`)
}