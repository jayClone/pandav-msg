import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { connectDB } from '@config/db.js';
import { createSocketServer } from '@socket/socket.server.js';

const PORT = process.env.PORT || 5000;

// ✅ CRITICAL: Connect to DB first, then start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB Connected');

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Attach Socket.IO
    createSocketServer(httpServer);

    // Start listening
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 API Base URL: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
