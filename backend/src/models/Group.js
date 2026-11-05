import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "moderator", "member"],
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    groupPic: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: {
      type: [groupMemberSchema],
      required: true,
      validate: [
        {
          validator: (members) => members.length >= 1,
          message: "A group must have at least one member.",
        },
        {
          validator: (members) => {
            const memberIds = members.map((member) =>
              member.userId.toString()
            );
            return new Set(memberIds).size === memberIds.length;
          },
          message: "Duplicate members are not allowed.",
        },
        {
          validator: (members) => {
            const adminCount = members.filter(
              (member) => member.role === "admin"
            ).length;
            return adminCount === 1;
          },
          message: "A group must have exactly one admin.",
        },
      ],
    },
  },
  { timestamps: true }
);

groupSchema.index({ "members.userId": 1 });
groupSchema.index({ updatedAt: -1 });

const Group = mongoose.model("Group", groupSchema);

export default Group;
