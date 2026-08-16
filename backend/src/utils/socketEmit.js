// REST controllers reach the shared Socket.IO instance via `req.app.get('io')`
// (set once in server.js) rather than importing it directly — `io` isn't
// attached to the app at all in the test environment (app.js is imported
// directly there with no socket server), so every emit has to fail open.
// This centralizes that guard instead of repeating it at every call site.

export const emitToUser = (req, userId, event, payload) => {
  const io = req.app.get('io');
  if (io && userId) {
    io.to(userId.toString()).emit(event, payload);
  }
};

export const emitToRoom = (req, roomId, event, payload) => {
  const io = req.app.get('io');
  if (io && roomId) {
    io.to(roomId.toString()).emit(event, payload);
  }
};
