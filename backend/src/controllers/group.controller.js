
import cloudinary from "../lib/cloudinary.js";
import { io } from "../lib/socket.js";
import mongoose from "mongoose";
import Group from "../models/Group.js";
import User from "../models/User.js";
import Message from "../models/message.js";

const createGroupSystemMessage = async ({
    groupId,
    actorId,
    event,
    text,
}) => {
    const message = await Message.create({
        messageType: "group",
        isSystemMessage: true,
        systemEvent: event,
        senderId: actorId,
        groupId,
        text,
    });

    await message.populate("senderId", "fullName profilePic");

    io.to(groupId.toString()).emit("newGroupMessage", message);

    return message;
};

// CREATE GROUP
export const createGroup = async (req, res) => {
    try {
        const { name, description, memberIds } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Group name is required",
            });
        }

        if (!Array.isArray(memberIds)) {
            return res.status(400).json({
                success: false,
                message: "Member IDs must be an array",
            });
        }

        const uniqueMemberIds = [
            ...new Set([
                req.user._id.toString(),
                ...memberIds.map((id) => id.toString()),
            ]),
        ];

        if (uniqueMemberIds.length < 2) {
            return res.status(400).json({
                success: false,
                message: "A group must have at least 2 members",
            });
        }

        const validUsers = await User.find({
            _id: { $in: uniqueMemberIds },
        }).select("_id");

        if (validUsers.length !== uniqueMemberIds.length) {
            return res.status(400).json({
                success: false,
                message: "One or more users do not exist",
            });
        }

        const group = await Group.create({
            name: name.trim(),
            description: description?.trim() || "",
            createdBy: req.user._id,
            members: uniqueMemberIds.map((userId) => ({
                userId,
                role:
                    userId === req.user._id.toString()
                        ? "admin"
                        : "member",
            })),
        });

        await Promise.all(
            uniqueMemberIds.map((userId) =>
                io.in(userId).socketsJoin(group._id.toString())
            )
        );

        await group.populate(
            "members.userId",
            "fullName profilePic email"
        );

        uniqueMemberIds.forEach((userId) => {
            io.to(userId).emit("groupCreated", group);
        });

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            group,
        });
    } catch (error) {
        console.error("Create group error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create group",
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

// GET MY FORMER GROUPS (ARCHIVED GROUPS)
export const getMyFormerGroups = async (req, res) => {
    try {
        const userId = req.user._id;

        const groups = await Group.find({
            "formerMembers.userId": userId,
            "members.userId": { $ne: userId },
        })
            .populate("members.userId", "fullName profilePic email")
            .populate("createdBy", "fullName profilePic")
            .populate("formerMembers.userId", "fullName profilePic")
            .sort({ updatedAt: -1 });

        return res.status(200).json({
            message: "Archived groups fetched successfully.",
            groups,
        });
    } catch (error) {
        console.error("Error in getMyFormerGroups:", error);

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

// UPDATE GROUP DETAILS
export const updateGroupDetails = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description, groupPic } = req.body;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID.",
            });
        }

        if (
            name === undefined &&
            description === undefined &&
            groupPic === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "At least one group detail is required.",
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found.",
            });
        }

        const requester = group.members.find(
            (member) =>
                member.userId.toString() === userId.toString()
        );

        if (!requester || requester.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only group admins can update group details.",
            });
        }

        if (name !== undefined) {
            if (
                typeof name !== "string" ||
                name.trim().length < 3 ||
                name.trim().length > 50
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Group name must be between 3 and 50 characters.",
                });
            }

            group.name = name.trim();
        }

        if (description !== undefined) {
            if (
                typeof description !== "string" ||
                description.length > 500
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Description cannot exceed 500 characters.",
                });
            }

            group.description = description.trim();
        }

        if (groupPic !== undefined) {
            if (typeof groupPic !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid group picture.",
                });
            }

            if (groupPic.trim()) {
                const uploadResponse = await cloudinary.uploader.upload(
                    groupPic,
                    {
                        folder: "chatify/group_pictures",
                    }
                );

                group.groupPic = uploadResponse.secure_url;
            } else {
                group.groupPic = "";
            }
        }

        await group.save();

        await group.populate(
            "members.userId",
            "fullName profilePic email"
        );

        await group.populate(
            "createdBy",
            "fullName profilePic"
        );

        // TEMPORARY DIAGNOSTIC LOGGING
        const groupRoom = io.sockets.adapter.rooms.get(
            groupId.toString()
        );

        console.log("GROUP UPDATE DEBUG:", {
            groupId: groupId.toString(),
            socketsInGroupRoom: groupRoom
                ? [...groupRoom]
                : [],
            socketCount: groupRoom?.size || 0,
            connectedSocketCount: io.sockets.sockets.size,
        });

        io.to(groupId.toString()).emit("groupUpdated", {
            group,
        });

        return res.status(200).json({
            success: true,
            message: "Group details updated successfully.",
            group,
        });
    } catch (error) {
        console.error("Error in updateGroupDetails:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update group details.",
        });
    }
};

// ADD MEMBERS TO GROUP
export const addMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { memberIds } = req.body;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                message: "Invalid group ID.",
            });
        }

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
            (id) =>
                typeof id !== "string" ||
                !mongoose.Types.ObjectId.isValid(id)
        );

        if (invalidIds) {
            return res.status(400).json({
                message: "One or more member IDs are invalid.",
            });
        }

        const uniqueMemberIds = [...new Set(memberIds)];

        if (uniqueMemberIds.length !== memberIds.length) {
            return res.status(400).json({
                message: "Duplicate member IDs are not allowed.",
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                message: "Group not found.",
            });
        }

        const requester = group.members.find(
            (member) =>
                member.userId.toString() === userId.toString()
        );

        if (!requester) {
            return res.status(403).json({
                message: "You are not a member of this group.",
            });
        }

        if (requester.role !== "admin") {
            return res.status(403).json({
                message: "Only group admins can add members.",
            });
        }

        const existingMemberIds = new Set(
            group.members.map((member) =>
                member.userId.toString()
            )
        );

        const alreadyMembers = uniqueMemberIds.filter(
            (id) => existingMemberIds.has(id)
        );

        if (alreadyMembers.length > 0) {
            return res.status(400).json({
                message: "One or more users are already group members.",
            });
        }

        if (group.members.length + uniqueMemberIds.length > 100) {
            return res.status(400).json({
                message: "A group cannot have more than 100 members.",
            });
        }

        const users = await User.find({
            _id: { $in: uniqueMemberIds },
        }).select("_id fullName");

        if (users.length !== uniqueMemberIds.length) {
            return res.status(404).json({
                message: "One or more selected users were not found.",
            });
        }

        // Remove previous membership history when a user rejoins.
        group.formerMembers = group.formerMembers.filter(
            (member) =>
                !uniqueMemberIds.includes(member.userId.toString())
        );

        group.members.push(
            ...uniqueMemberIds.map((id) => ({
                userId: id,
                role: "member",
            }))
        );

        await group.save();

        await group.populate(
            "members.userId",
            "fullName profilePic email"
        );

        // Join all connected devices of the added users to the group room.
        await Promise.all(
            uniqueMemberIds.map((id) =>
                io.in(id.toString()).socketsJoin(groupId.toString())
            )
        );

        // Notify existing group members about updated group details.
        io.to(groupId.toString()).emit("groupUpdated", {
            group,
        });

        // Send a personal notification to every newly added member.
        uniqueMemberIds.forEach((memberId) => {
            io.to(memberId.toString()).emit("groupMemberAdded", {
                group,
                addedBy: {
                    _id: userId,
                    fullName: req.user.fullName,
                },
                message: `${req.user.fullName} added you to ${group.name}.`,
            });
        });

        const addedMemberNames = users
            .map((user) => user.fullName)
            .join(", ");

        // Create a system message inside the group chat.
        await createGroupSystemMessage({
            groupId,
            actorId: userId,
            event: "members_added",
            text: `${req.user.fullName} added ${addedMemberNames} to the group.`,
        });

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

        if (
            !mongoose.Types.ObjectId.isValid(groupId) ||
            !mongoose.Types.ObjectId.isValid(memberId)
        ) {
            return res.status(400).json({
                message: "Invalid group or member ID.",
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                message: "Group not found.",
            });
        }

        const requester = group.members.find(
            (member) =>
                member.userId.toString() === userId.toString()
        );

        if (!requester) {
            return res.status(403).json({
                message: "You are not a member of this group.",
            });
        }

        if (requester.role !== "admin") {
            return res.status(403).json({
                message: "Only group admins can remove members.",
            });
        }

        if (userId.toString() === memberId) {
            return res.status(400).json({
                message: "Use the leave group feature to remove yourself.",
            });
        }

        const targetMember = group.members.find(
            (member) =>
                member.userId.toString() === memberId
        );

        if (!targetMember) {
            return res.status(404).json({
                message: "Member not found in this group.",
            });
        }

        const targetUser = await User.findById(memberId).select(
            "fullName"
        );

        if (!targetUser) {
            return res.status(404).json({
                message: "User not found.",
            });
        }

        // Record former membership before removing the active member.
        group.formerMembers = group.formerMembers.filter(
            (member) =>
                member.userId.toString() !== memberId
        );

        group.formerMembers.push({
            userId: memberId,
            removedAt: new Date(),
            removedBy: userId,
        });

        group.members = group.members.filter(
            (member) =>
                member.userId.toString() !== memberId
        );

        await group.save();

        await group.populate(
            "members.userId",
            "fullName profilePic email"
        );

        // Notify every connected device of the removed user.
        io.to(memberId).emit("groupRemoved", {
            groupId: groupId.toString(),
            message: "You have been removed from this group.",
            reason: "removed",
        });

        await io.in(memberId).socketsLeave(groupId.toString());

        io.to(groupId.toString()).emit("groupUpdated", {
            group,
        });

        await createGroupSystemMessage({
            groupId,
            actorId: userId,
            event: "member_removed",
            text: `${req.user.fullName} removed ${targetUser.fullName} from the group.`,
        });

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

// LEAVE GROUP
export const leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                message: "Invalid group ID.",
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                message: "Group not found.",
            });
        }

        const member = group.members.find(
            (member) =>
                member.userId.toString() === userId.toString()
        );

        if (!member) {
            return res.status(403).json({
                message: "You are not a member of this group.",
            });
        }

        if (member.role === "admin") {
            const adminCount = group.members.filter(
                (member) => member.role === "admin"
            ).length;

            if (adminCount === 1) {
                return res.status(400).json({
                    message: "You are the only admin. Promote another member before leaving.",
                });
            }
        }

        const leavingUser = await User.findById(userId).select(
            "fullName"
        );

        if (!leavingUser) {
            return res.status(404).json({
                message: "User not found.",
            });
        }

        // Record voluntary departure in former membership history.
        group.formerMembers = group.formerMembers.filter(
            (member) =>
                member.userId.toString() !== userId.toString()
        );

        group.formerMembers.push({
            userId,
            removedAt: new Date(),
            removedBy: userId,
        });

        group.members = group.members.filter(
            (member) =>
                member.userId.toString() !== userId.toString()
        );

        await group.save();

        await group.populate(
            "members.userId",
            "fullName profilePic email"
        );

        io.to(userId.toString()).emit("groupRemoved", {
            groupId: groupId.toString(),
            message: "You left this group.",
            reason: "left",
        });

        await io.in(userId.toString()).socketsLeave(
            groupId.toString()
        );

        io.to(groupId.toString()).emit("groupUpdated", {
            group,
        });

        await createGroupSystemMessage({
            groupId,
            actorId: userId,
            event: "member_left",
            text: `${leavingUser.fullName} left the group.`,
        });

        return res.status(200).json({
            message: "You left the group successfully.",
            group,
        });
    } catch (error) {
        console.error("Error in leaveGroup controller:", error);

        return res.status(500).json({
            message: "Internal server error.",
        });
    }
};

// UPDATE MEMBER ROLE
export const updateMemberRole = async (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const { role } = req.body;
        const userId = req.user._id;

        if (
            !mongoose.Types.ObjectId.isValid(groupId) ||
            !mongoose.Types.ObjectId.isValid(memberId)
        ) {
            return res.status(400).json({
                message: "Invalid group or member ID.",
            });
        }

        if (!["admin", "moderator", "member"].includes(role)) {
            return res.status(400).json({
                message: "Invalid role. Allowed roles: admin, moderator, member.",
            });
        }

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({
                message: "Group not found.",
            });
        }

        const requester = group.members.find(
            (member) =>
                member.userId.toString() === userId.toString()
        );

        if (!requester || requester.role !== "admin") {
            return res.status(403).json({
                message: "Only group admins can update member roles.",
            });
        }

        if (userId.toString() === memberId) {
            return res.status(400).json({
                message: "You cannot change your own role.",
            });
        }

        const targetMember = group.members.find(
            (member) =>
                member.userId.toString() === memberId
        );

        if (!targetMember) {
            return res.status(404).json({
                message: "Member not found.",
            });
        }

        if (targetMember.role === role) {
            return res.status(200).json({
                message: `Member already has the ${role} role.`,
            });
        }

        if (targetMember.role === "admin" && role !== "admin") {
            const adminCount = group.members.filter(
                (member) => member.role === "admin"
            ).length;

            if (adminCount === 1) {
                return res.status(400).json({
                    message: "A group must have at least one admin.",
                });
            }
        }

        const targetUser = await User.findById(memberId).select(
            "fullName"
        );

        if (!targetUser) {
            return res.status(404).json({
                message: "User not found.",
            });
        }

        const previousRole = targetMember.role;

        targetMember.role = role;

        await group.save();

        await group.populate(
            "members.userId",
            "fullName profilePic email"
        );

        io.to(groupId.toString()).emit("groupUpdated", {
            group,
        });

        await createGroupSystemMessage({
            groupId,
            actorId: userId,
            event: "role_updated",
            text: `${targetUser.fullName}'s role changed from ${previousRole} to ${role}.`,
        });

        return res.status(200).json({
            message: `Member role updated to ${role} successfully.`,
            group,
        });
    } catch (error) {
        console.error("Error in updateMemberRole:", error);

        return res.status(500).json({
            message: "Internal server error.",
        });
    }
};

// DELETE GROUP
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
        let memberIds = [];

        await session.withTransaction(async () => {
            errorResponse = null;
            memberIds = [];

            const group = await Group.findById(groupId).session(
                session
            );

            if (!group) {
                errorResponse = {
                    status: 404,
                    message: "Group not found.",
                };
                return;
            }

            const requester = group.members.find(
                (member) =>
                    member.userId.toString() === userId.toString()
            );

            if (!requester || requester.role !== "admin") {
                errorResponse = {
                    status: 403,
                    message: "Only group admins can delete this group.",
                };
                return;
            }

            // Include former members so their clients can also clear the deleted group.
            memberIds = [
                ...new Set([
                    ...group.members.map((member) =>
                        member.userId.toString()
                    ),
                    ...group.formerMembers.map((member) =>
                        member.userId.toString()
                    ),
                ]),
            ];

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

        for (const memberId of memberIds) {
            io.to(memberId).emit("groupRemoved", {
                groupId: groupId.toString(),
                message: "This group has been deleted by an admin.",
                reason: "deleted",
            });
        }

        await Promise.all(
            memberIds.map((memberId) =>
                io.in(memberId).socketsLeave(groupId.toString())
            )
        );

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
