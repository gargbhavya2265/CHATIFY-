import express from "express";
import {
    createGroup,
    getMyGroups,
    getMyFormerGroups,
    getGroupDetails,
    updateGroupDetails,
    addMembers,
    removeMember,
    leaveGroup,
    updateMemberRole,
    deleteGroup,
} from "../controllers/group.controller.js";

import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.post("/", createGroup);
router.get("/", getMyGroups);

// Archived groups — keep this before /:groupId
router.get("/former", getMyFormerGroups);

router.get("/:groupId", getGroupDetails);
router.post("/:groupId/members", addMembers);
router.delete("/:groupId/members/:memberId", removeMember);
router.post("/:groupId/leave", leaveGroup);
router.patch("/:groupId/members/:memberId/role", updateMemberRole);
router.delete("/:groupId", deleteGroup);
router.patch("/:groupId", updateGroupDetails);

export default router;