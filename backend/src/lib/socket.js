import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/message.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

const userSocketMap = {};

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", async (socket) => {
  console.log("A user connected", socket.user.fullName);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Mark pending messages as delivered when receiver comes online
  try {
    const pendingMessages = await Message.find({
      receiverId: userId,
      status: "sent",
    }).select("_id senderId");

    if (pendingMessages.length > 0) {
      const messageIds = pendingMessages.map((message) => message._id);

      await Message.updateMany(
        {
          _id: { $in: messageIds },
          status: "sent",
        },
        {
          $set: {
            status: "delivered",
            deliveredAt: new Date(),
          },
        }
      );

      const messagesBySender = new Map();

      for (const message of pendingMessages) {
        const senderId = message.senderId.toString();

        if (!messagesBySender.has(senderId)) {
          messagesBySender.set(senderId, []);
        }

        messagesBySender.get(senderId).push(message._id.toString());
      }

      for (const [senderId, messageIds] of messagesBySender) {
        const senderSocketId = getReceiverSocketId(senderId);

        if (senderSocketId) {
          io.to(senderSocketId).emit("messagesDelivered", {
            receiverId: userId,
            messageIds,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error marking pending messages as delivered:", error);
  }

  // Typing events
  socket.on("typing", ({ receiverId } = {}) => {
    if (typeof receiverId !== "string" || receiverId === userId) return;

    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", {
        senderId: userId,
      });
    }
  });

  socket.on("stopTyping", ({ receiverId } = {}) => {
    if (typeof receiverId !== "string" || receiverId === userId) return;

    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStoppedTyping", {
        senderId: userId,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);

    if (userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };