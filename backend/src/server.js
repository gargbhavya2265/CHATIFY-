import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.routes.js";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";

import { app, server } from "./lib/socket.js";

const __dirname = path.resolve();

const PORT = ENV.PORT || 3000;

connectDB();

// middleware
app.use(express.json({ limit: "5mb" }));

app.use(
  cors({
    origin:
      ENV.NODE_ENV === "development"
        ? ["http://localhost:5173", "http://localhost:5174"]
        : "https://chatify-frontend-hfwh.onrender.com",

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

server.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
});