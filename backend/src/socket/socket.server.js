import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketEvents } from './socket.event.js';

export function createSocketServer(httpServer) {
  const getOrigin = () => {
    const origins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3001',
    ];

    if (process.env.NODE_ENV === 'production') {
      origins.push('https://pandav-msg-frontend.vercel.app');
      origins.push('https://pandav-msg.vercel.app');
      origins.push('https://pandav.jaychaudhari.me');
    }

    return origins;
  };

  // ✅ CRITICAL: Proper Socket.IO configuration
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = getOrigin();
        
        console.log(`[SOCKET-CORS] Checking origin: ${origin || 'none'}`);
        
        if (!origin || allowedOrigins.includes(origin)) {
          console.log(`[SOCKET-CORS] ✅ ALLOWED`);
          callback(null, true);
        } else {
          console.warn(`[SOCKET-CORS] ❌ BLOCKED: ${origin}`);
          callback(new Error('CORS policy violation'));
        }
      },
      // ✅ CRITICAL: Methods MUST include GET and POST for polling
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      allowEIO3: true,
      allowEIO4: true
    },
    
    // ✅ Transport order: polling FIRST for mobile
    transports: ['polling', 'websocket'],
    
    // ✅ CRITICAL: Path must be /socket.io/
    path: '/socket.io/',
    
    // ✅ Polling settings
    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 60000,
    
    // ✅ Allow upgrade from polling to websocket
    allowUpgrades: true,
    
    // ✅ Other settings
    perMessageDeflate: {
      threshold: 1024
    }
  });

  const onlineUsers = new Map();

  io.use((socket, next) => {
    socketAuthMiddleware(socket, next);
  });

  console.log(`\n🔌 ================================`);
  console.log(`[SOCKET] Initializing Socket.IO`);
  console.log(`   CORS Origins: ${getOrigin().join(', ')}`);
  console.log(`   Transports: polling (primary), websocket (fallback)`);
  console.log(`   Path: /socket.io/`);
  console.log(`   Methods: GET, POST, OPTIONS`);
  console.log(`🔌 ================================\n`);

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    const transport = socket?.conn?.transport?.name || 'unknown';
    console.log(`   Transport: ${transport}`);
    
    registerSocketEvents(io, socket, onlineUsers);

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);
      const { userId } = socket.user || {};
      if (userId) onlineUsers.delete(userId);
      io.emit('onlineUsers', Array.from(onlineUsers.values()));
    });
  });

  return io;
}