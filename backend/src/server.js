import dotenv from "dotenv";
dotenv.config();

import http from "http";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { ensureIndexes } from "./config/indexes.js";
import { initRedis } from "./config/redis.js";
import { createSocketServer } from "./socket/socket.server.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log("🚀 Starting PandaV Server (Bun)...\n");

    console.log("📡 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ MongoDB Connected\n");

    // ✅ Create indexes
    console.log("📊 Syncing indexes...");
    await ensureIndexes();
    console.log("✅ Indexes ready\n");

    // ✅ Initialize Redis
    console.log("💾 Initializing Redis...");
    await initRedis();
    console.log("✅ Redis setup done\n");

    // ✅ Check Arcjet
    console.log("🛡️  Security with Arcjet...");
    if (process.env.ARCJET_KEY) {
      console.log(
        "✅ Arcjet enabled (rate limiting + bot detection + shield)\n"
      );
    } else {
      console.log(
        "⚠️  Arcjet not configured (ARCJET_KEY missing)\n"
      );
    }

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Attach Socket.IO
    const io = await createSocketServer(httpServer);

    // Lets plain REST controllers (friend/group mutations) emit live
    // notifications via `req.app.get('io')` without threading `io` through
    // every layer — same access pattern Express already uses for shared
    // singletons. Not set in the test environment (app.js is imported
    // directly there without a socket server), so every call site guards
    // with `if (io) {...}`, matching this app's existing fail-open pattern
    // for optional infra (Redis).
    app.set('io', io);

    // Start listening
    httpServer.listen(PORT, () => {
      console.log("╔═════════════════════════════════════════╗");
      console.log("║  ✅ SERVER RUNNING (BUN) ✅             ║");
      console.log("╚═════════════════════════════════════════╝");
      console.log(`\n🌍 Server: http://localhost:${PORT}`);
      console.log(`📝 API: http://localhost:${PORT}/api/v1`);
      console.log(`🛡️  Arcjet: Protected from bots & DDoS`);
      console.log(`📊 Health: http://localhost:${PORT}/api/v1/health\n`);
    });

    // ============================================
    // GRACEFUL SHUTDOWN
    // ============================================
    let shuttingDown = false;

    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;

      console.log(`\n🛑 ${signal} received, shutting down gracefully...`);

      // Force-exit if graceful shutdown hangs (e.g. a stuck keep-alive
      // connection never lets httpServer.close() finish on its own).
      const forceExitTimer = setTimeout(() => {
        console.error("⚠️  Graceful shutdown timed out, forcing exit");
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      io.close(() => {
        console.log("✅ Socket.IO connections closed");
      });

      httpServer.close(async () => {
        console.log("✅ HTTP server closed (no longer accepting new connections)");
        try {
          await mongoose.connection.close();
          console.log("✅ MongoDB connection closed");
        } catch (error) {
          console.error("⚠️  Error closing MongoDB connection:", error.message);
        } finally {
          clearTimeout(forceExitTimer);
          process.exit(0);
        }
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
