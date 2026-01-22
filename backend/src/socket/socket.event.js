import { MESSAGES, SOCKET_EVENTS } from "@constants/response.messages.js";
import Message from '@models/Message.js';
import Group from "@models/Group";
import User from "app/models/User";

const onlineUsers = new Map();

/**
 * Register all socket events
 * Handles: messaging, online status, disconnection
 */
export function registerSocketEvents(io, socket) {
    const { userId, email, name } = socket.user;

    console.log(`[SOCKET] User connected: ${name} (${userId})`);

    // set user user online in db
    User.findByIdAndUpdate(userId,{
        isOnline: true,
        lastSeen: Date.now()
    }).catch(err => console.error('Failed to update user online status:', err))



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
                    message: trimmedMessage,
                    chatType: 'private'
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

    // join group room
    socket.on('join_group', async (payload) => {
        try {
            const {groupId} = payload  || {};

            if (!groupId) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {
                    message: 'Group ID is Reuqired'
                });
                return;
            }

            // varify user is member
            const group = await Group.findById(groupId);
            if (!group) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: 'Group not found' 
                });
                return;
            }

            //join socket room
            socket.join(groupId);
            console.log(`[GROUP] ${name} joined group ${groupId}`)

            //notify group members
            io.to(groupId).emit('user_joined_group', {
                groupId: groupId,
                userId: userId,
                userName: name,
                message: `${name} joined the group`
            });
        } catch (error) {
            console.error('[ERROR] Join group failed:', error.message);
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: 'Failed to join group' 
            });
        }
    });

        // ✅ NEW: Group message handler
    socket.on('group_message', async (payload) => {
        try {
            const { groupId, message } = payload || {};

            if (!groupId) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: 'Group ID is required' 
                });
                return;
            }

            if (!message || typeof message !== "string" || message.trim().length === 0) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: "Message cannot be empty" 
                });
                return;
            }

            // ✅ Verify user is member
            const group = await Group.findById(groupId);
            if (!group) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: 'Group not found' 
                });
                return;
            }

            if (!group.participants.includes(userId)) {
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                    message: 'You are not a member of this group' 
                });
                return;
            }

            const trimmedMessage = message.trim();

            // ✅ Save to DB
            const savedMessage = await Message.create({
                senderId: userId,
                groupId: groupId,
                message: trimmedMessage,
                chatType: 'group'
            });

            console.log(`[GROUP-MSG] ${name} → ${groupId}: ${trimmedMessage.substring(0, 30)}`);

            const messagePayload = {
                _id: savedMessage._id,
                groupId: groupId,
                fromUserId: userId,
                fromUserName: name,
                message: trimmedMessage,
                time: savedMessage.createdAt.toISOString()
            };

            // ✅ Send to all group members
            io.to(groupId).emit('group_message', messagePayload);

            // ✅ Send confirmation to sender
            socket.emit(SOCKET_EVENTS.MESSAGE_SENT, {
                messageId: savedMessage._id,
                groupId: groupId,
                message: trimmedMessage,
                time: savedMessage.createdAt.toISOString(),
                saved: true
            });

        } catch (error) {
            console.error('[ERROR] Group message failed:', error.message);
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, { 
                message: 'Failed to send group message' 
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
    socket.on("disconnect", async () => {
        onlineUsers.delete(userId);
        
        // ✅ NEW: Set user offline in DB
        await User.findByIdAndUpdate(userId, { 
            isOnline: false,
            lastSeen: Date.now()
        }).catch(err => console.error('Failed to update user offline status:', err));
        
        broadcastOnlineUsers(io);
        console.log(`[SOCKET] Disconnected: ${name} (${userId})`);
    });
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