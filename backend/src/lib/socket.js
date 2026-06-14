import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import { ENV } from "./env.js";

const userSocketMap = {};
let io = null;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [ENV.CLIENT_URL],
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    const userId = socket.user?.id;

    if (!userId) {
      return socket.disconnect();
    }

    userSocketMap[userId] = socket.id;

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
  });
}

// ✅ IMPORTANT EXPORTS
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

export function getIO() {
  return io;
}