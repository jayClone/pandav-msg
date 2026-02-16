import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketEvents } from './socket.event.js';

export function createSocketServer(httpServer) {
  const getOrigin = () => {
    const origins = [
      // Local development
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3001',
    ];

    if (process.env.NODE_ENV === 'production') {
      origins.push(process.env.CLIENT_URL);
      
      // Vercel domains (both HTTP and HTTPS)
      origins.push('https://pandav-msg.vercel.app');
      origins.push('https://pandav-msg-frontend.vercel.app');
      origins.push('http://pandav-msg.vercel.app');
      origins.push('http://pandav-msg-frontend.vercel.app');
      
      // Custom domain
      origins.push('https://pandav.jaychaudhari.me');
      origins.push('http://pandav.jaychaudhari.me');
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
          console.warn(`[SOCKET-CORS] ❌ Blocked: ${origin}`);
          callback(new Error('CORS policy violation'));
        }
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      allowEIO3: true,
      allowEIO4: true
    },
    
    // ✅ TRANSPORT CONFIG
    transports: ['polling', 'websocket'],  // Polling first!
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