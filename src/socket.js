const { Server } = require("socket.io");

let io;

function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    // Allow clients to register their userId so we can emit to a room for that user
    // Client should emit: socket.emit('register', { userId: '<userId>' }) after connecting
    socket.on('register', (data) => {
      try {
        const userId = data && (data.userId || data.userId === 0 ? String(data.userId) : null);
        if (userId) {
          const room = `user:${userId}`;
          socket.join(room);
          console.log(`Socket ${socket.id} joined room ${room}`);
        }
      } catch (e) {
        console.warn('Failed to register socket to user room:', e.message || e);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

module.exports = { initSocket, getIO };
