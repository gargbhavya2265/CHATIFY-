import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ENV } from "../lib/env.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const cookies = socket.handshake.headers.cookie;

    let token = null;

    if (cookies) {
      token = cookies
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("jwt="))
        ?.split("=")[1];
    }

    if (!token) {
      return next(new Error("Unauthorized - No Token"));
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;
    socket.userId = user._id.toString();

    console.log(`Socket auth success: ${user.fullName}`);

    next();
  } catch (err) {
    console.log("Socket auth error:", err.message);
    next(new Error("Unauthorized"));
  }
};