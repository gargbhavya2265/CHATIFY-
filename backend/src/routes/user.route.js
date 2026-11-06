
import express from "express";
import {
  getUserProfile,
  updateUserAbout,
} from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/:id/profile", getUserProfile);
router.put("/about", updateUserAbout);

export default router;
