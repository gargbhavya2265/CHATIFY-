
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL =
    import.meta.env.MODE === "development"
        ? "http://localhost:3000"
        : "https://chatify-backend-dtzg.onrender.com";

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isCheckingAuth: true,
    isSigningUp: false,
    isLoggingIn: false,
    socket: null,
    onlineUsers: [],
    lastSeenUpdates: {},

    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");
            set({ authUser: res.data });
            get().connectSocket();
        } catch (error) {
            console.log("Error in authCheck:", error);
            set({ authUser: null });
        } finally {
            set({ isCheckingAuth: false });
        }
    },

    signup: async (data) => {
        set({ isSigningUp: true });
        try {
            const res = await axiosInstance.post("/auth/signup", data);
            set({ authUser: res.data });

            toast.success("Account created successfully!");
            get().connectSocket();
        } catch (error) {
            toast.error(error.response?.data?.message || "Signup failed");
        } finally {
            set({ isSigningUp: false });
        }
    },

    login: async (data) => {
        set({ isLoggingIn: true });
        try {
            const res = await axiosInstance.post("/auth/login", data);
            set({ authUser: res.data });

            toast.success("Logged in successfully");

            get().connectSocket();
        } catch (error) {
            toast.error(error.response?.data?.message || "Login failed");
        } finally {
            set({ isLoggingIn: false });
        }
    },

    logout: async () => {
        try {
            await axiosInstance.post("/auth/logout");
            get().disconnectSocket();

            set({
                authUser: null,
                onlineUsers: [],
                lastSeenUpdates: {},
            });

            toast.success("Logged out successfully");
        } catch (error) {
            toast.error("Error logging out");
            console.log("Logout error:", error);
        }
    },

    updateProfile: async (data) => {
        try {
            const res = await axiosInstance.put("/auth/update-profile", data);

            set((state) => ({
                authUser: {
                    ...state.authUser,
                    ...res.data,
                },
            }));

            toast.success("Profile updated successfully");
            return true;
        } catch (error) {
            console.log("Error in update profile:", error);
            toast.error(
                error.response?.data?.message || "Profile update failed"
            );
            return false;
        }
    },

    connectSocket: () => {
        const { authUser } = get();

        if (!authUser || get().socket?.connected) return;

        const socket = io(BASE_URL, {
            withCredentials: true,
            autoConnect: false,
        });

        set({ socket });

        socket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });

        socket.on("userLastSeen", ({ userId, lastSeen } = {}) => {
            if (!userId || !lastSeen) return;

            set((state) => ({
                lastSeenUpdates: {
                    ...state.lastSeenUpdates,
                    [userId]: lastSeen,
                },
            }));
        });

        socket.connect();
    },

    disconnectSocket: () => {
        const socket = get().socket;

        if (socket) {
            socket.disconnect();
            socket.removeAllListeners();
        }

        set({
            socket: null,
            onlineUsers: [],
        });
    },
}));
