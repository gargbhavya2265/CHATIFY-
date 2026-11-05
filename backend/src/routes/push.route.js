import express from "express";
import {
  getVapidPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
} from "../controllers/push.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe", subscribeToPush);
router.delete("/unsubscribe", unsubscribeFromPush);

export default router;
