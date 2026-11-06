
import { io } from "../lib/socket.js";
import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import { ENV } from "../lib/env.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
    const { fullName, email, password } = req.body;

    try {
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters",
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const user = await User.findOne({ email });

        if (user) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
        });

        if (newUser) {
            const savedUser = await newUser.save();

            generateToken(savedUser._id, res);

            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic,
            });

            try {
                await sendWelcomeEmail(
                    savedUser.email,
                    savedUser.fullName,
                    ENV.CLIENT_URL
                );
            } catch (error) {
                console.error("Failed to send welcome email:", error);
            }
        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        console.log("Error in signup controller:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required",
        });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        generateToken(user._id, res);

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
        });
    } catch (error) {
        console.error("Error in login controller:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const logout = (_, res) => {
    res.cookie("jwt", "", {
        maxAge: 0,
        httpOnly: true,
        sameSite: "strict",
        secure: ENV.NODE_ENV !== "development",
    });

    res.status(200).json({
        message: "Logged out successfully",
    });
};

export const updateProfile = async (req, res) => {
    try {
        const { fullName, about, profilePic } = req.body;
        const userId = req.user._id;

        const updateData = {};

        if (fullName !== undefined) {
            if (typeof fullName !== "string" || !fullName.trim()) {
                return res.status(400).json({
                    message: "Full name cannot be empty",
                });
            }

            updateData.fullName = fullName.trim();
        }

        if (about !== undefined) {
            if (typeof about !== "string" || about.trim().length > 150) {
                return res.status(400).json({
                    message: "About must be a string with maximum 150 characters",
                });
            }

            updateData.about = about.trim();
        }

        if (profilePic !== undefined) {
            if (typeof profilePic !== "string") {
                return res.status(400).json({
                    message: "Invalid profile picture",
                });
            }

            if (profilePic.trim()) {
                const uploadResponse = await cloudinary.uploader.upload(
                    profilePic,
                    {
                        folder: "chatify/profile_pictures",
                    }
                );

                updateData.profilePic = uploadResponse.secure_url;
            } else {
                updateData.profilePic = "";
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                message: "No profile information provided",
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            {
                new: true,
                runValidators: true,
            }
        ).select("fullName profilePic about lastSeen createdAt updatedAt");

        if (!updatedUser) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        const publicProfile = {
            _id: updatedUser._id,
            fullName: updatedUser.fullName,
            profilePic: updatedUser.profilePic,
            about: updatedUser.about,
            lastSeen: updatedUser.lastSeen,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
        };

        // Notify everyone about the updated profile
        io.emit("profileUpdated", publicProfile);

        return res.status(200).json({
            ...publicProfile,
            email: req.user.email,
        });
    } catch (error) {
        console.log("Error in update profile:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
