// Single source of truth for allowed CORS origins, shared by both the
// Express REST API (app.js) and Socket.IO (socket.server.js). Previously
// each computed its own separate, inconsistent list, and a third array in
// app.js that included CLIENT_URL/FRONTEND_URL was built but never actually
// used by the enforcement logic — those env vars had zero effect.
export const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'https://pandav-msg.vercel.app',
  'https://pandav-msg-frontend.vercel.app',
  'https://pandav.jaychaudhari.me',
  'https://www.pandav.jaychaudhari.me',
  // The Capacitor Android app's WebView serves its bundled files from its
  // own local virtual host — "https://localhost", not the real site's
  // origin — so requests from the packaged app carry this as Origin.
  'https://localhost',
  'capacitor://localhost',
].filter(Boolean);

export default allowedOrigins;
