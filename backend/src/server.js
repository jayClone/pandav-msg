import http from 'http'
import app from "./app";
import { createSocketServer } from './socket/socket.server.js';

const PORT = process.env.PORT || 5000;

// http server from express app
const httpServer  = http.createServer(app)

// Attached socket.io to same server
createSocketServer(httpServer);

// start server
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
