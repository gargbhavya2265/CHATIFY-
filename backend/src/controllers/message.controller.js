import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.js";
import User from "../models/User.js";
import { sendPushNotification } from "../lib/pushService.js";

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

    const unreadMessages = await Message.find({
      senderId: userToChatId,
      receiverId: myId,
      status: { $ne: "read" },
    }).select("_id");

    const messageIds = unreadMessages.map((message) => message._id);

    if (messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
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
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).populate("replyTo", "text image senderId");

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessageAsRead = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const receiverId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
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

    if (!text && !image) {
      return res.status(400).json({
        message: "Text or image is required.",
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
        $or: [
          {
            senderId,
            receiverId,
          },
          {
            senderId: receiverId,
            receiverId: senderId,
          },
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
      senderId,
      receiverId,
      text,
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

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const conversations = await Message.aggregate([
      {
        $match: {
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

    const partnerIds = conversations.map(
      (conversation) => conversation._id
    );

    const users = await User.find({
      _id: { $in: partnerIds },
    }).select("-password");

    const userMap = new Map(
      users.map((user) => [user._id.toString(), user.toObject()])
    );

    const chatPartners = conversations
      .map((conversation) => {
        const user = userMap.get(conversation._id.toString());

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

    const message = await Message.findOne({
      _id: messageId,
      $or: [
        { senderId: userId },
        { receiverId: userId },
      ],
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found.",
      });
    }

    // Prevent users from reacting to their own messages.
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

    const senderSocketId = getReceiverSocketId(message.senderId.toString());
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageReactionUpdated", reactionUpdate);
    }

    if (receiverSocketId && receiverSocketId !== senderSocketId) {
      io.to(receiverSocketId).emit("messageReactionUpdated", reactionUpdate);
    }

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

    const senderSocketId = getReceiverSocketId(message.senderId.toString());
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageUpdated", update);
    }

    if (receiverSocketId && receiverSocketId !== senderSocketId) {
      io.to(receiverSocketId).emit("messageUpdated", update);
    }

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

    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
    });

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

    message.text = "This message was deleted";
    message.image = undefined;
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.reactions = [];

    await message.save();

    const update = {
      message: message.toObject(),
    };

    const senderSocketId = getReceiverSocketId(message.senderId.toString());
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageDeleted", update);
    }

    if (receiverSocketId && receiverSocketId !== senderSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", update);
    }

    res.status(200).json({
      message: "Message deleted successfully.",
      updatedMessage: message,
    });
  } catch (error) {
    console.log("Error in deleteMessage:", error.message);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};