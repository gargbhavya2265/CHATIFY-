import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import { sendPushNotification } from "../lib/pushService.js";
import { Readable } from "node:stream";

const isGroupMember = async (groupId, userId) => {
    return Group.exists({
        _id: groupId,
        "members.userId": userId,
    });
};


const uploadAudioToCloudinary = (file) => {
    return new Promise((resolve, reject) => {
        const sourceStream = Readable.from(file.buffer);

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: "video",
                folder: "chatify/voice-messages",
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }

                if (!result?.secure_url || !result?.public_id) {
                    return reject(
                        new Error("Cloudinary returned an invalid upload result.")
                    );
                }

                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                });
            }
        );

        sourceStream.on("error", (error) => {
            uploadStream.destroy(error);
            reject(error);
        });

        uploadStream.on("error", reject);

        sourceStream.pipe(uploadStream);
    });
};

// Check whether a user is either an active or former group member.
const getGroupMembership = async (groupId, userId) => {
    const group = await Group.findOne({
        _id: groupId,
        $or: [
            { "members.userId": userId },
            { "formerMembers.userId": userId },
        ],
    }).select("members formerMembers");

    if (!group) {
        return null;
    }

    const activeMember = group.members.some(
        (member) => member.userId.toString() === userId.toString()
    );

    const formerMember = group.formerMembers.some(
        (member) => member.userId.toString() === userId.toString()
    );

    return {
        group,
        isActiveMember: activeMember,
        isFormerMember: !activeMember && formerMember,
    };
};

const emitMessageUpdate = (message, eventName, update) => {
    if (message.messageType === "group" && message.groupId) {
        io.to(message.groupId.toString()).emit(eventName, update);
        return;
    }

    const senderSocketId = getReceiverSocketId(message.senderId.toString());
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());

    if (senderSocketId) {
        io.to(senderSocketId).emit(eventName, update);
    }

    if (receiverSocketId && receiverSocketId !== senderSocketId) {
        io.to(receiverSocketId).emit(eventName, update);
    }
};

export const getAllContacts = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        const filteredUsers = await User.find({
            _id: { $ne: loggedInUserId },
        }).select("-password");

        res.status(200).json(filteredUsers);
    } catch (error) {
        console.log("Error in getAllContacts:", error);
        res.status(500).json({ message: "Server error" });
    }
};


export const getMessagesByUserId = async (req, res) => {
    try {
        const myId = req.user._id;
        const { id: userToChatId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userToChatId)) {
            return res.status(400).json({
                message: "Invalid user ID.",
            });
        }

        const unreadMessages = await Message.find({
            messageType: { $in: ["direct", null] },
            senderId: userToChatId,
            receiverId: myId,
            status: { $ne: "read" },
            hiddenFor: { $ne: myId },
        }).select("_id");

        const messageIds = unreadMessages.map((message) => message._id);

        // Preserve unread message IDs before marking them as read.
        const unreadMessageIds = new Set(
            messageIds.map((id) => id.toString())
        );

        if (messageIds.length > 0) {
            await Message.updateMany(
                {
                    _id: { $in: messageIds },
                    receiverId: myId,
                },
                {
                    $set: {
                        status: "read",
                        readAt: new Date(),
                    },
                }
            );

            const senderSocketId = getReceiverSocketId(userToChatId);

            if (senderSocketId) {
                io.to(senderSocketId).emit("messagesRead", {
                    readerId: myId.toString(),
                    messageIds: messageIds.map((id) => id.toString()),
                });
            }
        }

        const messages = await Message.find({
            messageType: { $in: ["direct", null] },
            hiddenFor: { $ne: myId },
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId },
            ],
        })
            .populate("replyTo", "text image senderId")
            .sort({ createdAt: 1 });

        // Attach temporary unread metadata for the frontend.
        // This property is not persisted in MongoDB.
        const messagesWithUnreadMetadata = messages.map((message) => {
            const messageObject = message.toObject();

            return {
                ...messageObject,
                wasUnreadBeforeOpening: unreadMessageIds.has(
                    message._id.toString()
                ),
            };
        });

        res.status(200).json(messagesWithUnreadMetadata);
    } catch (error) {
        console.log("Error in getMessages controller:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// GET GROUP MESSAGES
// Active and former members can read group history.
export const getGroupMessages = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                message: "Invalid group ID.",
            });
        }

        const membership = await getGroupMembership(groupId, userId);

        if (!membership) {
            return res.status(403).json({
                message: "You do not have access to this group's messages.",
            });
        }

        const messages = await Message.find({
            messageType: "group",
            groupId,
            hiddenFor: { $ne: userId },
        })
            .populate("senderId", "fullName profilePic")
            .populate("replyTo", "text image senderId")
            .sort({ createdAt: 1 });

        const unreadMessages = membership.isActiveMember
            ? messages.filter((message) => {
                  const senderId =
                      message.senderId?._id?.toString() ||
                      message.senderId?.toString();

                  const alreadyRead = message.readBy.some(
                      (reader) => reader.userId.toString() === userId.toString()
                  );

                  return (
                      !message.isSystemMessage &&
                      senderId !== userId.toString() &&
                      !alreadyRead
                  );
              })
            : [];

        const readAt = new Date();

        const readResults = await Promise.all(
            unreadMessages.map(async (message) => {
                const result = await Message.updateOne(
                    {
                        _id: message._id,
                        readBy: {
                            $not: {
                                $elemMatch: { userId },
                            },
                        },
                    },
                    {
                        $push: {
                            readBy: {
                                userId,
                                readAt,
                            },
                        },
                    }
                );

                return {
                    messageId: message._id.toString(),
                    updated: result.modifiedCount > 0,
                };
            })
        );

        const newlyReadMessageIds = readResults
            .filter((result) => result.updated)
            .map((result) => result.messageId);

        const newlyReadMessageIdSet = new Set(newlyReadMessageIds);

        const responseMessages = messages.map((message) => {
            const messageId = message._id.toString();
            const wasUnreadBeforeOpening =
                newlyReadMessageIdSet.has(messageId);

            if (wasUnreadBeforeOpening) {
                message.readBy.push({
                    userId,
                    readAt,
                });
            }

            return {
                ...message.toObject(),
                wasUnreadBeforeOpening,
            };
        });

        if (newlyReadMessageIds.length > 0) {
            io.to(groupId.toString()).emit("groupMessagesRead", {
                groupId: groupId.toString(),
                readerId: userId.toString(),
                messageIds: newlyReadMessageIds,
                readAt,
            });
        }

        // Keep the existing array response format for frontend compatibility.
        res.status(200).json(responseMessages);
    } catch (error) {
        console.error("Error in getGroupMessages:", error.message);
        res.status(500).json({
            message: "Internal server error.",
        });
    }
};

export const markMessageAsRead = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const receiverId = req.user._id;

        const message = await Message.findOne({
            _id: messageId,
            messageType: { $in: ["direct", null] },
            receiverId,
        });

        if (!message) {
            return res.status(404).json({
                message: "Message not found.",
            });
        }

        if (message.status !== "read") {
            message.status = "read";
            message.readAt = new Date();

            await message.save();

            const senderSocketId = getReceiverSocketId(
                message.senderId.toString()
            );

            if (senderSocketId) {
                io.to(senderSocketId).emit("messagesRead", {
                    readerId: receiverId.toString(),
                    messageIds: [message._id.toString()],
                });
            }
        }

        res.status(200).json({
            message: "Message marked as read.",
            updatedMessage: message,
        });
    } catch (error) {
        console.log("Error in markMessageAsRead:", error.message);
        res.status(500).json({
            error: "Internal server error",
        });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image, replyTo } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        if ((!text || !text.trim()) && !image) {
            return res.status(400).json({
                message: "Text or image is required.",
            });
        }

        if (typeof text === "string" && text.trim().length > 2000) {
            return res.status(400).json({
                message: "Message cannot exceed 2000 characters.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
            return res.status(400).json({
                message: "Invalid receiver ID.",
            });
        }

        if (senderId.equals(receiverId)) {
            return res.status(400).json({
                message: "Cannot send messages to yourself.",
            });
        }

        const receiverExists = await User.exists({ _id: receiverId });

        if (!receiverExists) {
            return res.status(404).json({
                message: "Receiver not found.",
            });
        }

        let originalMessage = null;

        if (replyTo) {
            if (!mongoose.Types.ObjectId.isValid(replyTo)) {
                return res.status(400).json({
                    message: "Invalid reply message ID.",
                });
            }

            originalMessage = await Message.findOne({
                _id: replyTo,
                messageType: { $in: ["direct", null] },
                $or: [
                    { senderId, receiverId },
                    { senderId: receiverId, receiverId: senderId },
                ],
            });

            if (!originalMessage) {
                return res.status(404).json({
                    message: "Original message not found in this conversation.",
                });
            }
        }

        let imageUrl;

        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
            messageType: "direct",
            senderId,
            receiverId,
            text: text?.trim(),
            image: imageUrl,
            replyTo: originalMessage?._id || null,
        });

        await newMessage.save();

        await newMessage.populate("replyTo", "text image senderId");

        const receiverSocketId = getReceiverSocketId(receiverId);

        if (receiverSocketId) {
            newMessage.status = "delivered";
            newMessage.deliveredAt = new Date();

            await newMessage.save();

            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        await sendPushNotification(receiverId, {
            title: req.user.fullName,
            body: text || "Sent you a photo",
            icon: req.user.profilePic || "/avatar.png",
            senderId: senderId.toString(),
            url: `/?chat=${senderId.toString()}`,
        });

        res.status(201).json(newMessage);
    } catch (error) {
        console.log("Error in sendMessage controller:", error.message);
        res.status(500).json({
            error: "Internal server error",
        });
    }
};

export const sendGroupMessage = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const { text, image, replyTo } = req.body;
        const senderId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                message: "Invalid group ID.",
            });
        }

        if ((!text || !text.trim()) && !image) {
            return res.status(400).json({
                message: "Text or image is required.",
            });
        }

        if (typeof text === "string" && text.trim().length > 2000) {
            return res.status(400).json({
                message: "Message cannot exceed 2000 characters.",
            });
        }

        // Only active members can send group messages.
        const group = await Group.findOne({
            _id: groupId,
            "members.userId": senderId,
        });

        if (!group) {
            return res.status(403).json({
                message: "You are not an active member of this group.",
            });
        }

        let originalMessage = null;

        if (replyTo) {
            if (!mongoose.Types.ObjectId.isValid(replyTo)) {
                return res.status(400).json({
                    message: "Invalid reply message ID.",
                });
            }

            originalMessage = await Message.findOne({
                _id: replyTo,
                messageType: "group",
                groupId,
            });

            if (!originalMessage) {
                return res.status(404).json({
                    message: "Original message not found in this group.",
                });
            }
        }

        let imageUrl;

        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
            messageType: "group",
            senderId,
            groupId,
            text: text?.trim(),
            image: imageUrl,
            replyTo: originalMessage?._id || null,
            readBy: [
                {
                    userId: senderId,
                    readAt: new Date(),
                },
            ],
        });

        await newMessage.save();

        await newMessage.populate([
            {
                path: "senderId",
                select: "fullName profilePic",
            },
            {
                path: "replyTo",
                select: "text image senderId",
            },
        ]);

        io.to(groupId.toString()).emit("newGroupMessage", newMessage);

        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Error in sendGroupMessage:", error.message);
        res.status(500).json({
            message: "Internal server error.",
        });
    }
};

export const getChatPartners = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        const conversations = await Message.aggregate([
            {
                $match: {
                    messageType: { $in: ["direct", null] },
                    hiddenFor: { $ne: loggedInUserId },
                    $or: [
                        { senderId: loggedInUserId },
                        { receiverId: loggedInUserId },
                    ],
                },
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$senderId", loggedInUserId] },
                            "$receiverId",
                            "$senderId",
                        ],
                    },
                    lastMessage: {
                        $first: "$$ROOT",
                    },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$receiverId", loggedInUserId] },
                                        { $ne: ["$status", "read"] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

        const partnerIds = conversations
            .map((conversation) => conversation._id)
            .filter(Boolean);

        const users = await User.find({
            _id: { $in: partnerIds },
        }).select("-password");

        const userMap = new Map(
            users.map((user) => [user._id.toString(), user.toObject()])
        );

        const chatPartners = conversations
            .map((conversation) => {
                const user = userMap.get(conversation._id?.toString());

                if (!user) return null;

                return {
                    ...user,
                    lastMessage: conversation.lastMessage,
                    lastMessageAt: conversation.lastMessage.createdAt,
                    unreadCount: conversation.unreadCount,
                };
            })
            .filter(Boolean)
            .sort(
                (a, b) =>
                    new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
            );

        res.status(200).json(chatPartners);
    } catch (error) {
        console.error("Error in getChatPartners:", error.message);
        res.status(500).json({
            error: "Internal server error",
        });
    }
};

export const toggleMessageReaction = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;

        const isValidEmoji =
            typeof emoji === "string" &&
            emoji.length <= 32 &&
            [...new Intl.Segmenter("en", {
                granularity: "grapheme",
            }).segment(emoji)].length === 1 &&
            /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u.test(emoji);

        if (!isValidEmoji) {
            return res.status(400).json({
                message: "Invalid reaction emoji.",
            });
        }

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                message: "Message not found.",
            });
        }

        if (message.messageType === "group") {
            const member = await isGroupMember(message.groupId, userId);

            if (!member) {
                return res.status(403).json({
                    message: "You are not a member of this group.",
                });
            }
        } else {
            const isParticipant =
                message.senderId.toString() === userId.toString() ||
                message.receiverId?.toString() === userId.toString();

            if (!isParticipant) {
                return res.status(403).json({
                    message: "You cannot access this message.",
                });
            }
        }

        if (message.senderId.toString() === userId.toString()) {
            return res.status(403).json({
                message: "You cannot react to your own message.",
            });
        }

        const existingReaction = message.reactions.find(
            (reaction) => reaction.userId.toString() === userId.toString()
        );

        if (existingReaction) {
            if (existingReaction.emoji === emoji) {
                message.reactions = message.reactions.filter(
                    (reaction) => reaction.userId.toString() !== userId.toString()
                );
            } else {
                existingReaction.emoji = emoji;
            }
        } else {
            message.reactions.push({
                userId,
                emoji,
            });
        }

        await message.save();

        const reactionUpdate = {
            message: message.toObject(),
        };

        emitMessageUpdate(
            message,
            "messageReactionUpdated",
            reactionUpdate
        );

        res.status(200).json({
            message: "Reaction updated successfully.",
            updatedMessage: message,
        });
    } catch (error) {
        console.log("Error in toggleMessageReaction:", error.message);
        res.status(500).json({
            error: "Internal server error",
        });
    }
};

export const editMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const { text } = req.body;
        const userId = req.user._id;

        if (typeof text !== "string" || !text.trim()) {
            return res.status(400).json({
                message: "Message text cannot be empty.",
            });
        }

        if (text.trim().length > 2000) {
            return res.status(400).json({
                message: "Message cannot exceed 2000 characters.",
            });
        }

        const message = await Message.findOne({
            _id: messageId,
            senderId: userId,
        });

        if (!message) {
            return res.status(404).json({
                message: "Message not found.",
            });
        }

        if (message.messageType === "group") {
            const member = await isGroupMember(message.groupId, userId);

            if (!member) {
                return res.status(403).json({
                    message: "You are not a member of this group.",
                });
            }
        }

        if (message.isDeleted) {
            return res.status(400).json({
                message: "Deleted messages cannot be edited.",
            });
        }

        if (!message.text) {
            return res.status(400).json({
                message: "Only text messages can be edited.",
            });
        }

        message.text = text.trim();
        message.isEdited = true;

        await message.save();

        const update = {
            message: message.toObject(),
        };

        emitMessageUpdate(message, "messageUpdated", update);

        res.status(200).json({
            message: "Message edited successfully.",
            updatedMessage: message,
        });
    } catch (error) {
        console.log("Error in editMessage:", error.message);
        res.status(500).json({
            error: "Internal server error",
        });
    }
};


export const deleteMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({
                message: "Invalid message ID.",
            });
        }

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                message: "Message not found.",
            });
        }

        if (message.isDeleted) {
            return res.status(400).json({
                message: "Message is already deleted.",
            });
        }

        if (message.messageType === "group") {
            const group = await Group.findOne({
                _id: message.groupId,
                "members.userId": userId,
            });

            if (!group) {
                return res.status(403).json({
                    message: "You are not a member of this group.",
                });
            }

            const member = group.members.find(
                (member) =>
                    member.userId.toString() === userId.toString()
            );

            const isPrivileged = ["admin", "moderator"].includes(
                member.role
            );

            const isSender =
                message.senderId.toString() === userId.toString();

            if (!isPrivileged && !isSender) {
                return res.status(403).json({
                    message: "You can only delete your own messages.",
                });
            }
        } else {
            if (message.senderId.toString() !== userId.toString()) {
                return res.status(404).json({
                    message: "Message not found.",
                });
            }
        }

        // Keep the Cloudinary public ID before removing audio metadata.
        const audioPublicId = message.audio?.publicId;

        message.text = "This message was deleted";
        message.image = undefined;
        message.audio = undefined;
        message.isDeleted = true;
        message.deletedAt = new Date();
        message.deletedBy = userId;
        message.reactions = [];

        await message.save();

        await message.populate("deletedBy", "fullName");

        const update = {
            message: message.toObject(),
        };

        emitMessageUpdate(message, "messageDeleted", update);

        // Delete the actual audio from Cloudinary after the database save.
        if (audioPublicId) {
            try {
                await cloudinary.uploader.destroy(
                    audioPublicId,
                    {
                        resource_type: "video",
                    }
                );
            } catch (cleanupError) {
                console.error(
                    "Voice message Cloudinary cleanup failed:",
                    cleanupError.message
                );
            }
        }

        return res.status(200).json({
            message: "Message deleted successfully.",
            updatedMessage: message,
        });
    } catch (error) {
        console.error(
            "Error in deleteMessage:",
            error.message
        );

        return res.status(500).json({
            error: "Internal server error",
        });
    }
};

export const pinMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userId = req.user._id;
        const { isPinned } = req.body;
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({
                message: "Invalid message ID.",
            });
        }
        if (typeof isPinned !== "boolean") {
            return res.status(400).json({
                message: "isPinned must be a boolean.",
            });
        }
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                message: "Message not found.",
            });
        }
        if (message.isDeleted) {
            return res.status(400).json({
                message: "Deleted messages cannot be pinned.",
            });
        }
        if (message.messageType === "group") {
            const group = await Group.findOne({
                _id: message.groupId,
                "members.userId": userId,
            });
            if (!group) {
                return res.status(403).json({
                    message: "You are not an active member of this group.",
                });
            }

        } else {
            const isParticipant =
                message.senderId.toString() === userId.toString() ||
                message.receiverId.toString() === userId.toString();
            if (!isParticipant) {
                return res.status(403).json({
                    message: "You are not a participant in this conversation.",
                });
            }
        }
        if (message.isPinned === isPinned) {
            return res.status(200).json({
                message: isPinned
                    ? "Message is already pinned."
                    : "Message is already unpinned.",
                updatedMessage: message,
            });
        }
        message.isPinned = isPinned;
        message.pinnedAt = isPinned ? new Date() : null;
        message.pinnedBy = isPinned ? userId : null;
        await message.save();
        await message.populate("pinnedBy", "fullName");
        const update = {
            message: message.toObject(),
        };
        emitMessageUpdate(
            message,
            isPinned ? "messagePinned" : "messageUnpinned",
            update
        );
        return res.status(200).json({
            message: isPinned
                ? "Message pinned successfully."
                : "Message unpinned successfully.",
            updatedMessage: message,
        });
    } catch (error) {
        console.error("Error in pinMessage:", error.message);
        return res.status(500).json({
            message: "Internal server error.",
        });
    }
};
export const getPinnedMessages = async (req, res) => {
    try {
        const userId = req.user._id;
        const { groupId, userId: otherUserId } = req.query;
        let query = {
            isPinned: true,
            isDeleted: false,
            hiddenFor: { $ne: userId },
        };
        if (groupId) {
            if (!mongoose.Types.ObjectId.isValid(groupId)) {
                return res.status(400).json({
                    message: "Invalid group ID.",
                });
            }
            const isMember = await Group.exists({
                _id: groupId,
                "members.userId": userId,
            });
            if (!isMember) {
                return res.status(403).json({
                    message: "You are not an active member of this group.",
                });
            }
            query.messageType = "group";
            query.groupId = groupId;
        } else if (otherUserId) {
            if (
                !mongoose.Types.ObjectId.isValid(otherUserId) ||
                otherUserId.toString() === userId.toString()
            ) {
                return res.status(400).json({
                    message: "Invalid conversation user ID.",
                });
            }
            const otherUserExists = await User.exists({
                _id: otherUserId,
            });
            if (!otherUserExists) {
                return res.status(404).json({
                    message: "User not found.",
                });
            }
            query.messageType = "direct";
            query.$or = [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId },
            ];
        } else {
            return res.status(400).json({
                message: "Provide either groupId or userId.",
            });
        }
        const pinnedMessages = await Message.find(query)
            .populate("senderId", "fullName profilePic")
            .populate("pinnedBy", "fullName")
            .sort({ pinnedAt: -1 });
        return res.status(200).json({
            pinnedMessages,
        });
    } catch (error) {
        console.error("Error in getPinnedMessages:", error.message);
        return res.status(500).json({
            message: "Internal server error.",
        });
    }
};export const searchMessages = async (req, res) => {
    try {
        const userId = req.user._id;

        const {
            q = "",
            type = "all",
            senderId,
            from,
            to,
            media = "all",
            page = "1",
            limit = "20",
        } = req.query;

        const searchText = q.trim();

        if (
            !["all", "direct", "group"].includes(type) ||
            !["all", "images", "text"].includes(media)
        ) {
            return res.status(400).json({
                message: "Invalid search filters.",
            });
        }

        if (searchText.length > 200) {
            return res.status(400).json({
                message: "Search query cannot exceed 200 characters.",
            });
        }

        if (senderId && !mongoose.Types.ObjectId.isValid(senderId)) {
            return res.status(400).json({
                message: "Invalid sender ID.",
            });
        }

        const currentPage = Number(page);
        const pageSize = Number(limit);

        if (
            !Number.isInteger(currentPage) ||
            currentPage < 1 ||
            !Number.isInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 50
        ) {
            return res.status(400).json({
                message: "Invalid pagination values.",
            });
        }

        const dateFilter = {};

        if (from) {
            const fromDate = new Date(from);

            if (Number.isNaN(fromDate.getTime())) {
                return res.status(400).json({
                    message: "Invalid start date.",
                });
            }

            dateFilter.$gte = fromDate;
        }

        if (to) {
            const toDate = new Date(to);

            if (Number.isNaN(toDate.getTime())) {
                return res.status(400).json({
                    message: "Invalid end date.",
                });
            }

            toDate.setHours(23, 59, 59, 999);
            dateFilter.$lte = toDate;
        }

        if (
            dateFilter.$gte &&
            dateFilter.$lte &&
            dateFilter.$gte > dateFilter.$lte
        ) {
            return res.status(400).json({
                message: "Start date cannot be after end date.",
            });
        }

        const escapedQuery = searchText.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        const filters = [
            {
                isDeleted: { $ne: true },
                isSystemMessage: { $ne: true },
            },
            {
                hiddenFor: { $ne: userId },
            },
        ];

        if (searchText) {
            filters.push({
                text: {
                    $regex: escapedQuery,
                    $options: "i",
                },
            });
        }

        if (media === "images") {
            filters.push({
                image: { $exists: true, $ne: "" },
            });
        } else if (media === "text") {
            filters.push({
                text: { $exists: true, $ne: "" },
                image: { $in: [null, ""] },
            });
        }

        if (senderId) {
            filters.push({
                senderId: new mongoose.Types.ObjectId(senderId),
            });
        }

        if (Object.keys(dateFilter).length > 0) {
            filters.push({
                createdAt: dateFilter,
            });
        }

        const conversationFilters = [];

        if (type === "all" || type === "direct") {
            conversationFilters.push({
                messageType: { $in: ["direct", null] },
                $or: [
                    { senderId: userId },
                    { receiverId: userId },
                ],
            });
        }

        if (type === "all" || type === "group") {
            const accessibleGroups = await Group.find({
                dismissedBy: { $ne: userId },
                $or: [
                    { "members.userId": userId },
                    { "formerMembers.userId": userId },
                ],
            }).select("_id");

            const groupIds = accessibleGroups.map((group) => group._id);

            if (groupIds.length > 0) {
                conversationFilters.push({
                    messageType: "group",
                    groupId: { $in: groupIds },
                });
            }
        }

        if (conversationFilters.length === 0) {
            return res.status(200).json({
                results: [],
                pagination: {
                    page: currentPage,
                    limit: pageSize,
                    totalResults: 0,
                    totalPages: 0,
                    hasMore: false,
                },
            });
        }

        filters.push({
            $or: conversationFilters,
        });

        const query = { $and: filters };

        const totalResults = await Message.countDocuments(query);

        const results = await Message.find(query)
            .populate("senderId", "fullName profilePic")
            .populate("groupId", "name groupPic")
            .populate("replyTo", "text image senderId")
            .sort({ createdAt: -1, _id: -1 })
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize)
            .lean();

        const directPartnerIds = [
            ...new Set(
                results
                    .filter((message) => message.messageType !== "group")
                    .map((message) => {
                        const sender = message.senderId?._id?.toString();
                        const receiver = message.receiverId?.toString();

                        return sender === userId.toString()
                            ? receiver
                            : sender;
                    })
                    .filter(Boolean)
            ),
        ];

        const directPartners = await User.find({
            _id: { $in: directPartnerIds },
        }).select("fullName profilePic");

        const partnerMap = new Map(
            directPartners.map((user) => [
                user._id.toString(),
                user,
            ])
        );

        const formattedResults = results.map((message) => {
            if (message.messageType === "group") {
                return {
                    ...message,
                    chat: {
                        type: "group",
                        id: message.groupId?._id,
                        name: message.groupId?.name,
                        groupPic: message.groupId?.groupPic,
                    },
                };
            }

            const sender = message.senderId?._id?.toString();
            const receiver = message.receiverId?.toString();

            const partnerId =
                sender === userId.toString() ? receiver : sender;

            const partner = partnerMap.get(partnerId);

            return {
                ...message,
                chat: {
                    type: "direct",
                    id: partner?._id,
                    name: partner?.fullName,
                    profilePic: partner?.profilePic,
                },
            };
        });

        const totalPages = Math.ceil(totalResults / pageSize);

        return res.status(200).json({
            results: formattedResults,
            pagination: {
                page: currentPage,
                limit: pageSize,
                totalResults,
                totalPages,
                hasMore: currentPage < totalPages,
            },
        });
    } catch (error) {
        console.error("Error in searchMessages:", error.message);

        return res.status(500).json({
            message: "Internal server error.",
        });
    }
};

export const deleteChat = async (req, res) => {
    try {
        const myId = req.user._id;
        const { id: userToChatId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userToChatId)) {
            return res.status(400).json({
                message: "Invalid user ID.",
            });
        }

        if (myId.toString() === userToChatId) {
            return res.status(400).json({
                message: "You cannot delete a chat with yourself.",
            });
        }

        await Message.updateMany(
            {
                messageType: { $in: ["direct", null] },
                $or: [
                    { senderId: myId, receiverId: userToChatId },
                    { senderId: userToChatId, receiverId: myId },
                ],
            },
            {
                $addToSet: {
                    hiddenFor: myId,
                },
            }
        );

        io.to(myId.toString()).emit("chatDeleted", {
            chatId: userToChatId,
        });

        return res.status(200).json({
            message: "Chat deleted successfully.",
        });
    } catch (error) {
        console.error("Error in deleteChat:", error.message);

        return res.status(500).json({
            message: "Internal server error.",
        });
    }
};

export const sendVoiceMessage = async (req, res) => {
    let uploadedAudio = null;
    let messageSaved = false;

    try {
        const { id: receiverId } = req.params;
        const senderId = req.user._id;
        const duration = Number(req.body.duration);
        const audioFile = req.file;

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
            return res.status(400).json({
                message: "Invalid receiver ID.",
            });
        }

        if (senderId.equals(receiverId)) {
            return res.status(400).json({
                message: "Cannot send voice messages to yourself.",
            });
        }

        if (!audioFile) {
            return res.status(400).json({
                message: "Audio file is required.",
            });
        }

        if (
            !Number.isFinite(duration) ||
            duration <= 0 ||
            duration > 300
        ) {
            return res.status(400).json({
                message: "Voice message duration must be between 1 and 300 seconds.",
            });
        }

        const receiverExists = await User.exists({
            _id: receiverId,
        });

        if (!receiverExists) {
            return res.status(404).json({
                message: "Receiver not found.",
            });
        }

        uploadedAudio = await uploadAudioToCloudinary(audioFile);

        const newMessage = new Message({
            messageType: "direct",
            senderId,
            receiverId,
            audio: {
                url: uploadedAudio.url,
                publicId: uploadedAudio.publicId,
                duration,
                mimeType: audioFile.mimetype
                    .split(";")[0]
                    .trim()
                    .toLowerCase(),
                fileSize: audioFile.size,
            },
        });

        await newMessage.save();
        messageSaved = true;

        const receiverSocketId = getReceiverSocketId(receiverId);

        if (receiverSocketId) {
            try {
                newMessage.status = "delivered";
                newMessage.deliveredAt = new Date();

                await newMessage.save();

                io.to(receiverSocketId).emit(
                    "newMessage",
                    newMessage
                );
            } catch (deliveryError) {
                console.error(
                    "Voice message delivery update failed:",
                    deliveryError.message
                );
            }
        }

        try {
            await sendPushNotification(receiverId, {
                title: req.user.fullName,
                body: "Sent you a voice message",
                icon: req.user.profilePic || "/avatar.png",
                senderId: senderId.toString(),
                url: `/?chat=${senderId.toString()}`,
            });
        } catch (notificationError) {
            console.error(
                "Voice message push notification failed:",
                notificationError.message
            );
        }

        return res.status(201).json(newMessage);
    } catch (error) {
        console.error(
            "Error in sendVoiceMessage:",
            error.message
        );

        if (uploadedAudio?.publicId && !messageSaved) {
            try {
                await cloudinary.uploader.destroy(
                    uploadedAudio.publicId,
                    { resource_type: "video" }
                );
            } catch (cleanupError) {
                console.error(
                    "Voice upload cleanup failed:",
                    cleanupError.message
                );
            }
        }

        return res.status(500).json({
            message: "Failed to send voice message.",
        });
    }
};

export const sendGroupVoiceMessage = async (req, res) => {
    let uploadedAudio = null;
    let messageSaved = false;

    try {
        const { id: groupId } = req.params;
        const { replyTo } = req.body;
        const senderId = req.user._id;
        const duration = Number(req.body.duration);
        const audioFile = req.file;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                message: "Invalid group ID.",
            });
        }

        if (!audioFile) {
            return res.status(400).json({
                message: "Audio file is required.",
            });
        }

        if (
            !Number.isFinite(duration) ||
            duration <= 0 ||
            duration > 300
        ) {
            return res.status(400).json({
                message: "Voice message duration must be between 1 and 300 seconds.",
            });
        }

        const group = await Group.findOne({
            _id: groupId,
            "members.userId": senderId,
        });

        if (!group) {
            return res.status(403).json({
                message: "You are not an active member of this group.",
            });
        }

        let originalMessage = null;

        if (replyTo) {
            if (!mongoose.Types.ObjectId.isValid(replyTo)) {
                return res.status(400).json({
                    message: "Invalid reply message ID.",
                });
            }

            originalMessage = await Message.findOne({
                _id: replyTo,
                messageType: "group",
                groupId,
            });

            if (!originalMessage) {
                return res.status(404).json({
                    message: "Original message not found in this group.",
                });
            }
        }

        uploadedAudio = await uploadAudioToCloudinary(audioFile);

        const newMessage = new Message({
            messageType: "group",
            senderId,
            groupId,
            audio: {
                url: uploadedAudio.url,
                publicId: uploadedAudio.publicId,
                duration,
                mimeType: audioFile.mimetype
                    .split(";")[0]
                    .trim()
                    .toLowerCase(),
                fileSize: audioFile.size,
            },
            replyTo: originalMessage?._id || null,
            readBy: [
                {
                    userId: senderId,
                    readAt: new Date(),
                },
            ],
        });

        await newMessage.save();
        messageSaved = true;

        await newMessage.populate([
            {
                path: "senderId",
                select: "fullName profilePic",
            },
            {
                path: "replyTo",
                select: "text image audio senderId",
            },
        ]);

        io.to(groupId.toString()).emit(
            "newGroupMessage",
            newMessage
        );

        return res.status(201).json(newMessage);
    } catch (error) {
        console.error(
            "Error in sendGroupVoiceMessage:",
            error.message
        );

        if (uploadedAudio?.publicId && !messageSaved) {
            try {
                await cloudinary.uploader.destroy(
                    uploadedAudio.publicId,
                    { resource_type: "video" }
                );
            } catch (cleanupError) {
                console.error(
                    "Group voice upload cleanup failed:",
                    cleanupError.message
                );
            }
        }

        return res.status(500).json({
            message: "Failed to send group voice message.",
        });
    }
};

export const forwardMessage = async (req, res) => {
    const uploadedMedia = [];
    const savedMessages = [];
    const socketEvents = [];

    try {
        const senderId = req.user._id;
        const { messageId, destinations } = req.body;

        // Validate source message ID.
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({
                message: "Invalid message ID.",
            });
        }

        // Validate destination count.
        if (
            !Array.isArray(destinations) ||
            destinations.length === 0 ||
            destinations.length > 20
        ) {
            return res.status(400).json({
                message: "Select between 1 and 20 destinations.",
            });
        }

        // Validate and normalize destinations.
        const normalizedDestinations = [];
        const destinationKeys = new Set();

        for (const destination of destinations) {
            if (
                !destination ||
                !["direct", "group"].includes(destination.type) ||
                !mongoose.Types.ObjectId.isValid(destination.id)
            ) {
                return res.status(400).json({
                    message: "Invalid destination.",
                });
            }

            const key = `${destination.type}:${destination.id}`;

            if (destinationKeys.has(key)) {
                return res.status(400).json({
                    message: "Duplicate destinations are not allowed.",
                });
            }

            destinationKeys.add(key);

            normalizedDestinations.push({
                type: destination.type,
                id: new mongoose.Types.ObjectId(destination.id),
            });
        }

        // Find original message.
        const source = await Message.findById(messageId);

        if (!source) {
            return res.status(404).json({
                message: "Message not found.",
            });
        }

        // Check whether this message can be forwarded.
        if (
            source.isDeleted ||
            source.isSystemMessage ||
            source.hiddenFor.some(
                (id) => id.toString() === senderId.toString()
            )
        ) {
            return res.status(403).json({
                message: "This message cannot be forwarded.",
            });
        }

        // Verify that the current user can access the source message.
        if (source.messageType === "direct") {
            const isParticipant =
                source.senderId.toString() === senderId.toString() ||
                source.receiverId.toString() === senderId.toString();

            if (!isParticipant) {
                return res.status(403).json({
                    message: "You cannot forward this message.",
                });
            }
        } else if (source.messageType === "group") {
            const membership = await getGroupMembership(
                source.groupId,
                senderId
            );

            if (!membership) {
                return res.status(403).json({
                    message: "You cannot access this message.",
                });
            }
        } else {
            return res.status(400).json({
                message: "Unsupported message type.",
            });
        }

        // Check whether the source contains forwardable content.
        if (!source.text && !source.image && !source.audio?.url) {
            return res.status(400).json({
                message: "This message has no forwardable content.",
            });
        }

        // Preserve the original sender when forwarding an already
        // forwarded message.
        const originalSender = source.forwardedFrom
            ? {
                  messageId: source.forwardedFrom.messageId,
                  senderId: source.forwardedFrom.senderId,
                  senderName: source.forwardedFrom.senderName,
                  senderProfilePic:
                      source.forwardedFrom.senderProfilePic || "",
              }
            : await User.findById(source.senderId)
                  .select("fullName profilePic")
                  .then((user) =>
                      user
                          ? {
                                messageId: source._id,
                                senderId: user._id,
                                senderName: user.fullName,
                                senderProfilePic: user.profilePic || "",
                            }
                          : null
                  );

        if (!originalSender) {
            return res.status(400).json({
                message: "Original sender information is unavailable.",
            });
        }

        // Validate every destination before uploading or saving anything.
        for (const destination of normalizedDestinations) {
            if (destination.type === "direct") {
                if (destination.id.equals(senderId)) {
                    return res.status(400).json({
                        message: "You cannot forward a message to yourself.",
                    });
                }

                const recipientExists = await User.exists({
                    _id: destination.id,
                });

                if (!recipientExists) {
                    return res.status(404).json({
                        message: "A selected contact was not found.",
                    });
                }
            } else {
                const activeMembership = await Group.exists({
                    _id: destination.id,
                    "members.userId": senderId,
                });

                if (!activeMembership) {
                    return res.status(403).json({
                        message:
                            "You must be an active member of every selected group.",
                    });
                }
            }
        }

        // Create and save all forwarded messages first.
        // Socket events are emitted only after every save succeeds.
        for (const destination of normalizedDestinations) {
            let imageUrl;
            let audio;

            // Upload an independent image for each destination.
            if (source.image) {
                const imageUpload = await cloudinary.uploader.upload(
                    source.image
                );

                uploadedMedia.push({
                    publicId: imageUpload.public_id,
                    resourceType: "image",
                });

                imageUrl = imageUpload.secure_url;
            }

            // Upload an independent voice asset for each destination.
            if (source.audio?.url) {
                const audioUpload = await cloudinary.uploader.upload(
                    source.audio.url,
                    {
                        resource_type: "video",
                        folder: "chatify/voice-messages",
                    }
                );

                uploadedMedia.push({
                    publicId: audioUpload.public_id,
                    resourceType: "video",
                });

                audio = {
                    url: audioUpload.secure_url,
                    publicId: audioUpload.public_id,
                    duration: source.audio.duration,
                    mimeType: source.audio.mimeType,
                    fileSize: source.audio.fileSize,
                };
            }

            const messageData = {
                messageType: destination.type,
                senderId,
                text: source.text,
                image: imageUrl,
                audio,
                forwardedFrom: originalSender,
            };

            let receiverSocketId = null;

            if (destination.type === "direct") {
                messageData.receiverId = destination.id;

                // Check whether the recipient is currently online.
                receiverSocketId = getReceiverSocketId(
                    destination.id.toString()
                );

                // Match the existing direct-message delivery behavior.
                if (receiverSocketId) {
                    messageData.status = "delivered";
                    messageData.deliveredAt = new Date();
                }
            } else {
                messageData.groupId = destination.id;
                messageData.readBy = [
                    {
                        userId: senderId,
                        readAt: new Date(),
                    },
                ];
            }

            const forwardedMessage = new Message(messageData);

            await forwardedMessage.save();

            // Track immediately so rollback can remove this message
            // even if population fails afterward.
            savedMessages.push(forwardedMessage);

            await forwardedMessage.populate([
                {
                    path: "senderId",
                    select: "fullName profilePic",
                },
                {
                    path: "forwardedFrom.senderId",
                    select: "fullName profilePic",
                },
            ]);

            // Store socket events instead of emitting immediately.
            socketEvents.push({
                type: destination.type,
                destinationId: destination.id.toString(),
                receiverSocketId,
                message: forwardedMessage,
            });
        }

        // All messages have now been saved and populated successfully.
        // It is safe to notify recipients.
        for (const event of socketEvents) {
            if (event.type === "direct") {
                // Notify the recipient only if they are online.
                if (event.receiverSocketId) {
                    io.to(event.receiverSocketId).emit(
                        "newMessage",
                        event.message
                    );
                }

                // Always notify the sender.
                io.to(senderId.toString()).emit(
                    "newMessage",
                    event.message
                );
            } else {
                io.to(event.destinationId).emit(
                    "newGroupMessage",
                    event.message
                );
            }
        }

        return res.status(201).json({
            message: "Message forwarded successfully.",
            forwardedMessages: savedMessages,
        });
    } catch (error) {
        console.error("Error in forwardMessage:", error.message);

        // Roll back all messages created during this forwarding operation.
        if (savedMessages.length > 0) {
            await Message.deleteMany({
                _id: {
                    $in: savedMessages.map((message) => message._id),
                },
            }).catch((cleanupError) => {
                console.error(
                    "Forwarded message rollback failed:",
                    cleanupError.message
                );
            });
        }

        // Remove all independently uploaded Cloudinary assets.
        await Promise.all(
            uploadedMedia.map((media) =>
                cloudinary.uploader
                    .destroy(media.publicId, {
                        resource_type: media.resourceType,
                    })
                    .catch((cleanupError) => {
                        console.error(
                            "Forwarded media cleanup failed:",
                            cleanupError.message
                        );
                    })
            )
        );

        return res.status(500).json({
            message: "Failed to forward message.",
        });
    }
};


