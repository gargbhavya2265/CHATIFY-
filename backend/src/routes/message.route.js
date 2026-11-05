import express from "express";
import {
  getAllContacts,
  getChatPartners,
  getMessagesByUserId,
  sendMessage,
  markMessageAsRead,
  toggleMessageReaction,
  editMessage,
  deleteMessage,
  getGroupMessages,
  sendGroupMessage,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/contacts", getAllContacts);
router.get("/chats", getChatPartners);

// Group messaging routes
router.get("/groups/:id", getGroupMessages);
router.post("/groups/:id", sendGroupMessage);

// Direct messaging routes
router.get("/:id", getMessagesByUserId);
router.post("/send/:id", sendMessage);
router.patch("/:id/read", markMessageAsRead);
router.patch("/:id/reaction", toggleMessageReaction);
router.patch("/:id", editMessage);
router.delete("/:id", deleteMessage);

export default router;
