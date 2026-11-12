
import User from "../models/User.js";

export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("fullName email profilePic about lastSeen createdAt")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      ...user,
      isOwnProfile: user._id.toString() === req.user._id.toString(),
    });
  } catch (error) {
    console.log("Error in getUserProfile:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUserAbout = async (req, res) => {
  try {
    const { about } = req.body;

    if (typeof about !== "string") {
      return res.status(400).json({
        message: "About must be a string",
      });
    }

    const trimmedAbout = about.trim();

    if (trimmedAbout.length > 150) {
      return res.status(400).json({
        message: "About cannot exceed 150 characters",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { about: trimmedAbout } },
      {
        new: true,
        runValidators: true,
      }
    ).select("fullName profilePic about");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "About updated successfully",
      user,
    });
  } catch (error) {
    console.log("Error in updateUserAbout:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
