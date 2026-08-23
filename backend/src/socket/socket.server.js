import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketEvents } from './socket.event.js';
import { allowedOrigins } from '../config/cors.js';
import { getRedis } from '../config/redis.js';

export async function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket'],

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

    // Was 1e6 (1MB) — too small for an image message, then raised to 8MB;
    // now 16MB to match Message.js's imageCiphertext ceiling for video.
    // Safe to raise: unlike text, an encrypted image/video is never fanned
    // out per-recipient (see Message.js), so this bound doesn't multiply
    // with group size the way a per-member text payload would.
    maxHttpBufferSize: 16 * 1024 * 1024,
    pingInterval: 25000,
    pingTimeout: 90000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });


  const onlineUsers = new Map();

  // Multi-instance support: without this, presence/rooms/broadcasts only
  // reach sockets connected to the same process — silent data loss the
  // moment there's more than one server instance. Falls back to Socket.IO's
  // default in-memory adapter (single-instance only) if Redis isn't
  // available, matching this app's existing fail-open Redis pattern.
  const pubClient = getRedis();
  if (pubClient) {
    try {
      const subClient = pubClient.duplicate();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.IO Redis adapter attached (multi-instance ready)');
    } catch (error) {
      console.warn('⚠️  Socket.IO Redis adapter setup failed, falling back to in-memory adapter:', error.message);
    }
  } else {
    console.warn('⚠️  Redis not available — Socket.IO using in-memory adapter (single-instance only)');
  }

  io.use((socket, next) => {
    socketAuthMiddleware(socket, next);
  });

  io.on('connection', (socket) => {
    console.log(` Connected: ${socket.id}`);
    registerSocketEvents(io, socket, onlineUsers);
  });

  return io;
}
