import { MESSAGES, SOCKET_EVENTS } from "../constant/response.messages.js";
// In-memory online users store (Day-3 only) to learn yeye
const onlineUsers =  new Map();
// userId -> websocket

export function registerSocketEvents(io, socket){
    const{userId, email} = socket.user;

    //1. mark user online
    onlineUsers.set(userId, socket.id)
    
    //2. tell all guys whose online rn
    io.emit(SOCKET_EVENTS.ONLINE_USERS, Array.from(onlineUsers.keys()));

    console.log(`[SOCKET] Connected: ${email} (${userId}) -> ${socket.id}`);

    //3. recive message from sender
    socket.on(SOCKET_EVENTS.PRIVATE_MESSAGE, (payload) =>{
        try {
            const {toUserId, message} = payload || {};

            if (!toUserId || typeof toUserId !== "string"){
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {message: MESSAGES.SOCKET.TO_USER_REQUIRED});
                return;
            }
            if (!message || typeof message !== "string" || message.trim().length === 0){
                socket.emit(SOCKET_EVENTS.ERROR_MESSAGE, {message: MESSAGES.SOCKET.MESSAGE_EMPTY});
                return;
            }

            const reciverSocketId = onlineUsers.get(toUserId);

            //if reciver offline
            if(!reciverSocketId){
                socket.emit(SOCKET_EVENTS.USER_OFFLINE,{toUserId});
                return;
            }

            // send message to reciver only
            io.to(reciverSocketId).emit(SOCKET_EVENTS.PRIVATE_MESSAGE,{
                fromUserId: userId,
                message: message.trim(),
                time: new Date().toISOString(),
            });

            // confirm back to seder
            socket.emit(SOCKET_EVENTS.MESSAGE_SENT,{
                toUserId,
                message: message.trim(),
                time: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit(SOCKET_EVENTS.ERROR_MESSAGE,{message: MESSAGES.SOCKET.SOMETHING_WENT_WRONG})
        }
    });

    //4. handle dissconnect
    socket.on("disconnect",() =>{
        onlineUsers.delete(userId);

        io.emit(SOCKET_EVENTS.ONLINE_USERS, Array.from(onlineUsers.keys()));

        console.log(`[SOCKET] Disconnected: ${email} (${userId})`)
    });
}