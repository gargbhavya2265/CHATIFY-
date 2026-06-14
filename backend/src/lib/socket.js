import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import { ENV } from "./env.js";

const userSocketMap = {};
let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        ENV.CLIENT_URL,
      ],
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log("A user connected");

    const userId = socket.user?.id || socket.userId;

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

  return io;
}

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}