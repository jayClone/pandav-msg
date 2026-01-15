import {Server} from 'socket.io'
import {socketAuthMiddleware} from './socket.auth.js'
import { registerSocketEvents } from './socket.event.js'

export function createSocketServer(httpServer){
    // Create Socket.IO server attached to HTTP server
    const io = new Server(httpServer, {
        cors:{
            origin: process.env.CLIENT_URL, // Allow frontend to connect
            credentials: true
        }
    });

    // jwt auth for socket
    io.use(socketAuthMiddleware)
    
    // Listen for new connections
    io.on("connection", (socket) =>{
        registerSocketEvents(io, socket)
    });

    console.log("[SOCKET] Socket.io Initialized")

    return io
}