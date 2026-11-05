import express from "express";
import {
  createGroup,
  getMyGroups,
  getGroupDetails,
  addMembers,
  removeMember,
  leaveGroup,
  transferOwnership,
  updateMemberRole,
  deleteGroup,
} from "../controllers/group.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.post("/", createGroup);
router.get("/", getMyGroups);
router.get("/:groupId", getGroupDetails);
router.post("/:groupId/members", addMembers);
router.delete("/:groupId/members/:memberId", removeMember);
router.post("/:groupId/leave", leaveGroup);
router.patch("/:groupId/transfer-ownership", transferOwnership);
router.patch("/:groupId/members/:memberId/role", updateMemberRole);
router.delete("/:groupId", deleteGroup);

export default router;
