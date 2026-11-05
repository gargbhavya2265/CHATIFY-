import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.js";
import User from "../models/User.js";

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
    });

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
    const { text, image } = req.body;
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
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      const deliveredMessage = await Message.findByIdAndUpdate(
        newMessage._id,
        {
          $set: {
            status: "delivered",
            deliveredAt: new Date(),
          },
        },
        { new: true }
      );

      io.to(receiverSocketId).emit("newMessage", deliveredMessage);

      return res.status(201).json(deliveredMessage);
    }

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

    const messages = await Message.find({
      $or: [
        { senderId: loggedInUserId },
        { receiverId: loggedInUserId },
      ],
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
    }).select("-password");

    res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Error in getChatPartners:", error.message);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};
