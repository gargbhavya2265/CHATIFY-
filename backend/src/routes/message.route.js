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
    deleteChat,
    searchMessages,
    getGroupMessages,
    sendGroupMessage,
    sendVoiceMessage,
    sendGroupVoiceMessage,
    forwardMessage,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";
import { uploadVoiceMessage } from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/contacts", getAllContacts);
router.get("/chats", getChatPartners);
router.delete("/chats/:id", deleteChat);

// Group messaging routes
router.get("/groups/:id", getGroupMessages);
router.post("/groups/:id", sendGroupMessage);
router.post("/groups/:id/voice", uploadVoiceMessage, sendGroupVoiceMessage);

// Message search route
router.get("/search", searchMessages);

// Message forwarding route
router.post("/forward", forwardMessage);

// Direct messaging routes
router.get("/:id", getMessagesByUserId);
router.post("/send/:id", sendMessage);
router.patch("/:id/read", markMessageAsRead);
router.patch("/:id/reaction", toggleMessageReaction);
router.patch("/:id", editMessage);
router.delete("/:id", deleteMessage);
router.post("/voice/:id", uploadVoiceMessage, sendVoiceMessage);

export default router;
