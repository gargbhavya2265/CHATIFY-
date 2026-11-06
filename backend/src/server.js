import express from "express";
import cookieParser from "cookie-parser";
// import path from "path";
import cors from "cors";
import pushRoutes from "./routes/push.route.js";
import groupRoutes from "./routes/group.route.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import userRoutes from "./routes/user.route.js";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";

// const __dirname = path.resolve();

const PORT = ENV.PORT || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(cookieParser());

app.use("/api/push", pushRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/users", userRoutes);

// // make ready for deployment
// if (ENV.NODE_ENV === "production") {
//   app.use(express.static(path.join(__dirname, "../frontend/dist")));

//   app.get("*", (_, res) => {
//     res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
//   });
// }

// Health check route
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

server.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
  connectDB();
});