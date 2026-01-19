import {Server} from 'socket.io'
import {socketAuthMiddleware} from '@socket/socket.auth.js'
import { registerSocketEvents } from '@socket/socket.event.js'

export function createSocketServer(httpServer){
    // Get CORS origin based on environment
    const getOrigin = () => {
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        if (isDevelopment) {
            return ['http://localhost:3000', 'http://localhost:5173'];
        }
        return process.env.CLIENT_URL;
    };

    // Create Socket.IO server attached to HTTP server
    const io = new Server(httpServer, {
        cors: {
            origin: getOrigin(),  // ✅ Dynamic origin
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