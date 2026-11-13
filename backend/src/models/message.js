
import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        emoji: {
            type: String,
            required: true,
        },
    },
    { _id: false }
);

const readBySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        readAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const audioSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true,
        },
        publicId: {
            type: String,
            required: true,
        },
        duration: {
            type: Number,
            required: true,
            min: 0,
            max: 300,
        },
        mimeType: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
            required: true,
            min: 1,
            max: 10 * 1024 * 1024,
        },
    },
    { _id: false }
);

const forwardedFromSchema = new mongoose.Schema(
    {
        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            required: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        senderName: {
            type: String,
            required: true,
        },
        senderProfilePic: {
            type: String,
            default: "",
        },
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        messageType: {
            type: String,
            enum: ["direct", "group"],
            default: "direct",
            required: true,
        },
        isSystemMessage: {
            type: Boolean,
            default: false,
        },
        systemEvent: {
            type: String,
            enum: [
                "members_added",
                "member_removed",
                "member_left",
                "role_updated",
                "ownership_transferred",
            ],
            default: null,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: function () {
                return this.messageType === "direct";
            },
        },
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: function () {
                return this.messageType === "group";
            },
        },
        text: {
            type: String,
            trim: true,
            maxlength: 2000,
        },
        image: {
            type: String,
        },
        audio: {
            type: audioSchema,
            default: undefined,
        },
        forwardedFrom: {
            type: forwardedFromSchema,
            default: undefined,
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        hiddenFor: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
            ],
            default: [],
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        status: {
            type: String,
            enum: ["sent", "delivered", "read"],
            default: "sent",
        },
        deliveredAt: {
            type: Date,
            default: null,
        },
        readAt: {
            type: Date,
            default: null,
        },
        readBy: {
            type: [readBySchema],
            default: [],
        },
        reactions: {
            type: [reactionSchema],
            default: [],
        },
    },
    { timestamps: true }
);

messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ hiddenFor: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
