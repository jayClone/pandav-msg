import dotenv from "dotenv";
dotenv.config();

import http from "http";
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
    createSocketServer(httpServer);

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
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
