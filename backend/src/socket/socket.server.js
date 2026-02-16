import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketEvents } from './socket.event.js';

export function createSocketServer(httpServer) {
  const getOrigin = () => {
    const origins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001'
    ];

    if (process.env.NODE_ENV === 'production') {
      // ✅ Add Vercel domain for production
      origins.push(process.env.CLIENT_URL);
      origins.push('https://pandav-msg.vercel.app');
      origins.push('https://pandav-msg-frontend.vercel.app');
    }

    return origins;
  };

  const io = new Server(httpServer, {
    cors: {
      origin: getOrigin(),
      methods: ['GET', 'POST'],
      credentials: true,
      allowEIO3: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  const onlineUsers = new Map();

  io.use((socket, next) => {
    socketAuthMiddleware(socket, next);
  });

  console.log(`\n🔌 ================================`);
  console.log(`[SOCKET] Initializing Socket.IO`);
  console.log(`   CORS Origin: ${getOrigin().join(', ')}`);
  console.log(`🔌 ================================\n`);

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    registerSocketEvents(io, socket, onlineUsers);

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);
      const { userId } = socket.user;
      onlineUsers.delete(userId);
      io.emit('onlineUsers', Array.from(onlineUsers.values()));
    });
  });

  console.log(`[SOCKET] Socket.IO Initialized Successfully\n`);
  return io;
}