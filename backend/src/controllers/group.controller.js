import mongoose from "mongoose";
import Group from "../models/Group.js";
import User from "../models/User.js";
import Message from "../models/message.js";

// CREATE GROUP
export const createGroup = async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const creatorId = req.user._id;

    // 1. Validate group name
    if (typeof name !== "string" || name.trim().length < 3) {
      return res.status(400).json({
        message: "Group name must contain at least 3 characters.",
      });
    }

    if (name.trim().length > 50) {
      return res.status(400).json({
        message: "Group name cannot exceed 50 characters.",
      });
    }

    // 2. Validate member IDs
    if (memberIds !== undefined && !Array.isArray(memberIds)) {
      return res.status(400).json({
        message: "Member IDs must be an array.",
      });
    }

    const selectedMemberIds = memberIds || [];

    if (selectedMemberIds.length > 99) {
      return res.status(400).json({
        message: "A group cannot have more than 100 members.",
      });
    }

    const allMemberIds = [
      creatorId.toString(),
      ...selectedMemberIds,
    ];

    // 3. Validate ObjectIds
    const invalidIds = allMemberIds.some(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );

    if (invalidIds) {
      return res.status(400).json({
        message: "One or more member IDs are invalid.",
      });
    }

    // 4. Prevent duplicate members
    const uniqueMemberIds = [...new Set(allMemberIds)];

    if (uniqueMemberIds.length !== allMemberIds.length) {
      return res.status(400).json({
        message: "Duplicate members are not allowed.",
      });
    }

    // 5. Verify all selected users exist
    const users = await User.find({
      _id: { $in: selectedMemberIds },
    }).select("_id");

    if (users.length !== selectedMemberIds.length) {
      return res.status(404).json({
        message: "One or more selected users were not found.",
      });
    }

    // 6. Create group members
    const members = [
      {
        userId: creatorId,
        role: "admin",
      },
      ...selectedMemberIds.map((userId) => ({
        userId,
        role: "member",
      })),
    ];

    // 7. Save group
    const group = await Group.create({
      name: name.trim(),
      description:
        typeof description === "string" ? description.trim() : "",
      createdBy: creatorId,
      members,
    });

    // 8. Populate member information
    await group.populate("members.userId", "fullName profilePic email");

    return res.status(201).json({
      message: "Group created successfully.",
      group,
    });
  } catch (error) {
    console.error("Error in createGroup:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
};

// GET MY GROUPS
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({
      "members.userId": userId,
    })
      .populate("members.userId", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      message: "Groups fetched successfully.",
      groups,
    });
  } catch (error) {
    console.error("Error in getMyGroups:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
};


 // GET GROUP DETAILS
export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID.",
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
    })
      .populate("members.userId", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic");

    if (!group) {
      return res.status(404).json({
        message: "Group not found or you are not a member.",
      });
    }

    return res.status(200).json({
      message: "Group details fetched successfully.",
      group,
    });
  } catch (error) {
    console.error("Error in getGroupDetails:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
};

// ADD MEMBERS TO GROUP
export const addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    // 1. Validate group ID
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID.",
      });
    }

    // 2. Validate member IDs
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        message: "At least one member ID is required.",
      });
    }

    if (memberIds.length > 100) {
      return res.status(400).json({
        message: "Too many members requested.",
      });
    }

    const invalidIds = memberIds.some(
      (id) => typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)
    );

    if (invalidIds) {
      return res.status(400).json({
        message: "One or more member IDs are invalid.",
      });
    }

    // 3. Prevent duplicate IDs in request
    const uniqueMemberIds = [...new Set(memberIds)];

    if (uniqueMemberIds.length !== memberIds.length) {
      return res.status(400).json({
        message: "Duplicate member IDs are not allowed.",
      });
    }

    // 4. Find group and verify requester membership
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        message: "Group not found.",
      });
    }

    const requester = group.members.find(
      (member) => member.userId.toString() === userId.toString()
    );

    if (!requester) {
      return res.status(403).json({
        message: "You are not a member of this group.",
      });
    }

    // 5. Only admin and moderator can add members
    if (!["admin", "moderator"].includes(requester.role)) {
      return res.status(403).json({
        message: "You do not have permission to add members.",
      });
    }

    // 6. Prevent adding existing members
    const existingMemberIds = new Set(
      group.members.map((member) => member.userId.toString())
    );

    const alreadyMembers = uniqueMemberIds.filter(
      (id) => existingMemberIds.has(id)
    );

    if (alreadyMembers.length > 0) {
      return res.status(400).json({
        message: "One or more users are already group members.",
      });
    }

    // 7. Enforce group size limit
    if (group.members.length + uniqueMemberIds.length > 100) {
      return res.status(400).json({
        message: "A group cannot have more than 100 members.",
      });
    }

    // 8. Verify selected users exist
    const users = await User.find({
      _id: { $in: uniqueMemberIds },
    }).select("_id");

    if (users.length !== uniqueMemberIds.length) {
      return res.status(404).json({
        message: "One or more selected users were not found.",
      });
    }

    // 9. Add new members with default member role
    group.members.push(
      ...uniqueMemberIds.map((id) => ({
        userId: id,
        role: "member",
      }))
    );

    await group.save();

    await group.populate("members.userId", "fullName profilePic email");

    return res.status(200).json({
      message: "Members added successfully.",
      group,
    });
  } catch (error) {
    console.error("Error in addMembers:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
};


// REMOVE MEMBER FROM GROUP
export const removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user._id;

    // 1. Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(memberId)
    ) {
      return res.status(400).json({
        message: "Invalid group or member ID.",
      });
    }

    // 2. Find group
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        message: "Group not found.",
      });
    }

    // 3. Verify requester membership
    const requester = group.members.find(
      (member) => member.userId.toString() === userId.toString()
    );

    if (!requester) {
      return res.status(403).json({
        message: "You are not a member of this group.",
      });
    }

    // 4. Prevent self-removal through this endpoint
    if (userId.toString() === memberId) {
      return res.status(400).json({
        message: "Use the leave group feature to remove yourself.",
      });
    }

    // 5. Find target member
    const targetMember = group.members.find(
      (member) => member.userId.toString() === memberId
    );

    if (!targetMember) {
      return res.status(404).json({
        message: "Member not found in this group.",
      });
    }

    // 6. Role-based authorization
    if (requester.role === "member") {
      return res.status(403).json({
        message: "Members cannot remove other members.",
      });
    }

    if (
      requester.role === "moderator" &&
      targetMember.role !== "member"
    ) {
      return res.status(403).json({
        message: "Moderators can only remove regular members.",
      });
    }

    // 7. Remove target member
    group.members = group.members.filter(
      (member) => member.userId.toString() !== memberId
    );

    await group.save();

    await group.populate("members.userId", "fullName profilePic email");

    return res.status(200).json({
      message: "Member removed successfully.",
      group,
    });
  } catch (error) {
    console.error("Error in removeMember:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid group ID." });
    }

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const member = group.members.find(
      (member) => member.userId.toString() === userId.toString()
    );

    if (!member) {
      return res.status(403).json({
        message: "You are not a member of this group.",
      });
    }

    if (member.role === "admin") {
      return res.status(400).json({
        message: "Admin must transfer ownership before leaving the group.",
      });
    }

    group.members = group.members.filter(
      (member) => member.userId.toString() !== userId.toString()
    );

    await group.save();

    return res.status(200).json({
      message: "You left the group successfully.",
      group,
    });
  } catch (error) {
    console.error("Error in leaveGroup controller:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const transferOwnership = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { newAdminId } = req.body;
    const userId = req.user._id;

    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(newAdminId)
    ) {
      return res.status(400).json({ message: "Invalid group or member ID." });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const currentAdmin = group.members.find(
      (member) => member.userId.toString() === userId.toString()
    );

    if (!currentAdmin || currentAdmin.role !== "admin") {
      return res.status(403).json({ message: "Only the admin can transfer ownership." });
    }

    const newAdmin = group.members.find(
      (member) => member.userId.toString() === newAdminId
    );

    if (!newAdmin) {
      return res.status(404).json({ message: "New admin must be an existing group member." });
    }

    if (newAdmin.userId.toString() === userId.toString()) {
      return res.status(400).json({ message: "You are already the admin." });
    }

    currentAdmin.role = "moderator";
    newAdmin.role = "admin";

    await group.save();
    await group.populate("members.userId", "fullName profilePic email");

    return res.status(200).json({
      message: "Group ownership transferred successfully.",
      group,
    });
  } catch (error) {
    console.error("Error in transferOwnership:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const updateMemberRole = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user._id;

    if (
      !mongoose.Types.ObjectId.isValid(groupId) ||
      !mongoose.Types.ObjectId.isValid(memberId)
    ) {
      return res.status(400).json({ message: "Invalid group or member ID." });
    }

    if (!["moderator", "member"].includes(role)) {
      return res.status(400).json({
        message: "Role must be either moderator or member.",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const requester = group.members.find(
      (member) => member.userId.toString() === userId.toString()
    );

    if (!requester || requester.role !== "admin") {
      return res.status(403).json({
        message: "Only the group admin can update member roles.",
      });
    }

    const targetMember = group.members.find(
      (member) => member.userId.toString() === memberId
    );

    if (!targetMember) {
      return res.status(404).json({ message: "Member not found." });
    }

    if (targetMember.role === "admin") {
      return res.status(400).json({
        message: "Admin role cannot be changed here.",
      });
    }

    targetMember.role = role;

    await group.save();
    await group.populate("members.userId", "fullName profilePic email");

    return res.status(200).json({
      message: `Member role updated to ${role} successfully.`,
      group,
    });
  } catch (error) {
    console.error("Error in updateMemberRole:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const deleteGroup = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID.",
      });
    }

    let errorResponse = null;

    await session.withTransaction(async () => {
      errorResponse = null;

      const group = await Group.findById(groupId).session(session);

      if (!group) {
        errorResponse = {
          status: 404,
          message: "Group not found.",
        };
        return;
      }

      const requester = group.members.find(
        (member) => member.userId.toString() === userId.toString()
      );

      if (!requester || requester.role !== "admin") {
        errorResponse = {
          status: 403,
          message: "Only the group admin can delete this group.",
        };
        return;
      }

      await Message.deleteMany(
        { groupId: group._id },
        { session }
      );

      await Group.deleteOne(
        { _id: group._id },
        { session }
      );
    });

    if (errorResponse) {
      return res.status(errorResponse.status).json({
        message: errorResponse.message,
      });
    }

    return res.status(200).json({
      message: "Group and all associated messages deleted successfully.",
    });

  } catch (error) {
    console.error("Error in deleteGroup controller:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  } finally {
    await session.endSession();
  }
};