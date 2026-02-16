import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketEvents } from './socket.event.js';

export function createSocketServer(httpServer) {
  const getOrigin = () => {
    const origins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:5000',  // ✅ Add this
    ];

    if (process.env.NODE_ENV === 'production') {
      origins.push(process.env.CLIENT_URL);
      origins.push('https://pandav-msg.vercel.app');
      origins.push('https://pandav-msg-frontend.vercel.app');
      // ✅ Also allow HTTP on production (for polling fallback)
      origins.push('http://pandav-msg.vercel.app');
    }

    return origins;
  };

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = getOrigin();
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`⚠️ CORS blocked: ${origin}`);
          callback(new Error('CORS not allowed'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowEIO3: true
    },
    transports: ['polling', 'websocket'],
    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 60000,
    allowUpgrades: true,
  });

  const onlineUsers = new Map();

  io.use((socket, next) => {
    socketAuthMiddleware(socket, next);
  });

  console.log(`\n🔌 ================================`);
  console.log(`[SOCKET] Initializing Socket.IO`);
  console.log(`   CORS Origin: ${getOrigin().join(', ')}`);
  console.log(`   Transports: polling (primary), websocket (fallback)`);
  console.log(`🔌 ================================\n`);

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    
    // ✅ FIX: Use socket.conn instead of socket.io.engine
    const transport = socket.conn?.transport?.name || 'unknown';
    console.log(`   Transport: ${transport}`);
    
    registerSocketEvents(io, socket, onlineUsers);

    // ✅ FIX: Listen to upgrade event properly
    socket.conn?.on('upgrade', (newTransport) => {
      console.log(`📡 [TRANSPORT UPGRADE] ${socket.id}: ${newTransport.name}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);
      const { userId } = socket.user || {};
      if (userId) onlineUsers.delete(userId);
      io.emit('onlineUsers', Array.from(onlineUsers.values()));
    });
  });

  return io;
}