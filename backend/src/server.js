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

// middleware
app.use(express.json({ limit: "5mb" }));

// ✅ FIXED CORS (SAFE FOR DEV + PROD)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://chatify-frontend-hfwh.onrender.com",
    ],
    credentials: true,
  })
);

app.use(cookieParser());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// socket init
initSocket(server);

// server start
server.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
});