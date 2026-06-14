import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.routes.js";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { initSocket } from "./lib/socket.js";

const app = express();
const server = http.createServer(app);

const PORT = ENV.PORT || 3000;

connectDB();

app.use(express.json({ limit: "5mb" }));

app.use(
  cors({
    origin:
      ENV.NODE_ENV === "development"
        ? ["http://localhost:5173", "http://localhost:5174"]
        : ENV.CLIENT_URL,
    credentials: true,
  })
);

app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// 🔥 SOCKET INIT HERE (IMPORTANT)
initSocket(server);

server.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
});