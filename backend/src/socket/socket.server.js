import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketEvents } from './socket.event.js';

export function createSocketServer(httpServer) {
  const getOrigin = () => {
    const origins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
    ];

    if (process.env.NODE_ENV === 'production') {
      origins.push(process.env.CLIENT_URL);
      origins.push('https://pandav.jaychaudhari.me');  // ✅ Use Cloudflare domain
      origins.push('https://www.pandav.jaychaudhari.me');
    }

    return origins;
  };

  const io = new Server(httpServer, {
    cors: {
      origin: getOrigin(),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket'],

    //  Enable compression
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3,
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024,
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
    },

    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 90000,

    // ✅ OPTIMIZATION 5: Reduce reconnection spam
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  
  const onlineUsers = new Map();

  io.use((socket, next) => {
    socketAuthMiddleware(socket, next);
  });

  io.on('connection', (socket) => {
    console.log(`✅ Connected: ${socket.id}`);
    registerSocketEvents(io, socket, onlineUsers);

    socket.on('disconnect', () => {
      console.log(`❌ Disconnected: ${socket.id}`);
      const { userId } = socket.user || {};
      if (userId) onlineUsers.delete(userId);
      io.emit('online_users', Array.from(onlineUsers.values()));
    });
  });

  return io;
}