// In-memory online users store (Day-3 only) to learn yeye
const onlineUsers =  new Map();
// userId -> websocket

export function registerSocketEvents(io, socket){
    const{userId, email} = socket.user;

    //1. mark user online
    onlineUsers.set(userId, socket.id)
    
    //2. tell all guys whose online rn
    io.emit("online users", Array.from(onlineUsers.keys()));

    console.log(`[SOCKET] Connected: ${email} (${userId}) -> ${socket.id}`);

    //3. recive message from sender
    socket.on("Private messages", (payload) =>{
        try {
            const {toUserId, message} = payload || {};

            if (!toUserId || typeof toUserId !== "string"){
                socket.emit("error message", {message: "toUserId is reqired"});
                return;
            }
            if (!message || typeof message !== "string" || message.trim().length === 0){
                socket.emit("error message", {message: "message cannot be empty"});
                return;
            }

            const reciverSocketId = onlineUsers.get(toUserId);

            //if reciver offline
            if(!reciverSocketId){
                socket.emit("user offline",{toUserId});
                return;
            }

            // send message to reciver only
            io.to(reciverSocketId).emit("private_message",{
                fromUserId: userId,
                message: message.trim(),
                time: new Date().toISOString(),
            });

            // confirm back to seder
            socket.emit("message_sent",{
                toUserId,
                message: message.trim(),
                time: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit("error_message",{message: "something went wrong"})
        }
    });

    //4. handle dissconnect
    socket.on("disconnect",() =>{
        onlineUsers.delete(userId);

        io.emit("online_users", Array.from(onlineUsers.keys()));

        console.log(`[SOCKET] Disconnected: ${email} (${userId})`)
    });
}