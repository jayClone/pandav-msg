import { Server } from 'socket.io'
import { socketAuthMiddleware } from '@socket/socket.auth.js'
import { registerSocketEvents } from '@socket/socket.event.js'

export function createSocketServer(httpServer) {
  // Get CORS origin based on environment
  const getOrigin = () => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return ['http://localhost:3000', 'http://localhost:5173'];
    }
    return process.env.CLIENT_URL;
  };

  console.log(`\n🔌 ================================`);
  console.log(`[SOCKET] Initializing Socket.IO`);
  console.log(`   CORS Origin: ${getOrigin()}`);
  console.log(`🔌 ================================\n`);

  // Create Socket.IO server attached to HTTP server
  const io = new Server(httpServer, {
    cors: {
      origin: getOrigin(),  // ✅ Dynamic origin
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // ✅ JWT auth for socket
  io.use(socketAuthMiddleware);
  
  // ✅ Listen for new connections
  io.on("connection", (socket) => {
    console.log(`✅ [SOCKET] New client connected: ${socket.id}`);
    
    try {
      // ✅ Register all event handlers
      registerSocketEvents(io, socket);
    } catch (error) {
      console.error(`❌ [SOCKET] Error registering events: ${error.message}`);
      socket.emit('error', { message: 'Failed to initialize socket' });
    }
  });

  // ✅ Error handler
  io.on("error", (error) => {
    console.error(`❌ [SOCKET] Server error:`, error);
  });

  console.log(`[SOCKET] Socket.IO Initialized Successfully\n`);

  return io;
}