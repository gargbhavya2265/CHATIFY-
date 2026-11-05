
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,
  replyingTo: null,
  socketListeners: null,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedUser: (selectedUser) =>
    set({
      selectedUser,
      isTyping: false,
      replyingTo: null,
    }),

  setReplyingTo: (message) => set({ replyingTo: message }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });

    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMyChatPartners: async () => {
    set({ isUsersLoading: true });

    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });

    try {
      const res = await axiosInstance.get(`/messages/${userId}`);

      set({
        messages: res.data,
        replyingTo: null,
      });

      await get().getMyChatPartners();
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, replyingTo } = get();
    const { authUser } = useAuthStore.getState();

    if (!selectedUser || !authUser) return;

    const replyToId = replyingTo?._id || null;

    const payload = {
      ...messageData,
      ...(replyToId && { replyTo: replyToId }),
    };

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      replyTo: replyingTo,
      status: "sent",
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        payload
      );

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === tempId ? res.data : message
        ),
        replyingTo:
          state.replyingTo?._id === replyToId
            ? null
            : state.replyingTo,
      }));

      await get().getMyChatPartners();
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter(
          (message) => message._id !== tempId
        ),
      }));

      toast.error(error.response?.data?.message || "Something went wrong");
    }
  },

  toggleReaction: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.patch(
        `/messages/${messageId}/reaction`,
        { emoji }
      );

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === messageId
            ? res.data.updatedMessage
            : message
        ),
      }));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update reaction"
      );
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.patch(
        `/messages/${messageId}`,
        { text }
      );

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === messageId
            ? res.data.updatedMessage
            : message
        ),
      }));

      toast.success("Message edited");
      await get().getMyChatPartners();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to edit message"
      );
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === messageId
            ? res.data.updatedMessage
            : message
        ),
      }));

      toast.success("Message deleted");
      await get().getMyChatPartners();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to delete message"
      );
    }
  },

  subscribeToMessages: () => {
    const { selectedUser, isSoundEnabled } = get();

    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    if (!socket) return;

    const selectedUserId = selectedUser._id.toString();

    const handleNewMessage = async (newMessage) => {
      const senderId = (
        newMessage.senderId?._id || newMessage.senderId
      )?.toString();

      if (senderId !== selectedUserId) return;

      set((state) => ({
        messages: [...state.messages, newMessage],
      }));

      if (isSoundEnabled) {
        const notificationSound = new Audio("/sounds/notification.mp3");

        notificationSound.currentTime = 0;

        notificationSound.play().catch((error) =>
          console.log("Audio play failed:", error)
        );
      }

      try {
        const res = await axiosInstance.patch(
          `/messages/${newMessage._id}/read`
        );

        set((state) => ({
          messages: state.messages.map((message) =>
            message._id === newMessage._id
              ? {
                  ...message,
                  status: res.data.updatedMessage.status,
                  readAt: res.data.updatedMessage.readAt,
                }
              : message
          ),
        }));

        await get().getMyChatPartners();
      } catch (error) {
        console.log(
          "Error marking message as read:",
          error.response?.data?.message || error.message
        );
      }
    };

    const handleUserTyping = ({ senderId }) => {
      if (senderId?.toString() === selectedUserId) {
        set({ isTyping: true });
      }
    };

    const handleUserStoppedTyping = ({ senderId }) => {
      if (senderId?.toString() === selectedUserId) {
        set({ isTyping: false });
      }
    };

    const handleMessagesDelivered = ({ receiverId, messageIds } = {}) => {
      if (
        receiverId?.toString() !== selectedUserId ||
        !Array.isArray(messageIds)
      ) {
        return;
      }

      const deliveredMessageIds = new Set(
        messageIds.map((id) => id.toString())
      );

      set((state) => ({
        messages: state.messages.map((message) =>
          deliveredMessageIds.has(message._id.toString()) &&
          message.status !== "read"
            ? {
                ...message,
                status: "delivered",
              }
            : message
        ),
      }));
    };

    const handleMessagesRead = ({ readerId, messageIds } = {}) => {
      if (
        readerId?.toString() !== selectedUserId ||
        !Array.isArray(messageIds)
      ) {
        return;
      }

      const readMessageIds = new Set(
        messageIds.map((id) => id.toString())
      );

      set((state) => ({
        messages: state.messages.map((message) =>
          readMessageIds.has(message._id.toString())
            ? {
                ...message,
                status: "read",
                readAt: new Date().toISOString(),
              }
            : message
        ),
      }));
    };

    const handleMessageReactionUpdated = ({ message: updatedMessage } = {}) => {
      if (!updatedMessage?._id) return;

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === updatedMessage._id
            ? updatedMessage
            : message
        ),
      }));
    };

    const handleMessageUpdated = ({ message: updatedMessage } = {}) => {
      if (!updatedMessage?._id) return;

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === updatedMessage._id
            ? updatedMessage
            : message
        ),
      }));
    };

    const handleMessageDeleted = ({ message: updatedMessage } = {}) => {
      if (!updatedMessage?._id) return;

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === updatedMessage._id
            ? updatedMessage
            : message
        ),
      }));
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("userTyping", handleUserTyping);
    socket.on("userStoppedTyping", handleUserStoppedTyping);
    socket.on("messagesDelivered", handleMessagesDelivered);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("messageReactionUpdated", handleMessageReactionUpdated);
    socket.on("messageUpdated", handleMessageUpdated);
    socket.on("messageDeleted", handleMessageDeleted);

    set({
      socketListeners: {
        handleNewMessage,
        handleUserTyping,
        handleUserStoppedTyping,
        handleMessagesDelivered,
        handleMessagesRead,
        handleMessageReactionUpdated,
        handleMessageUpdated,
        handleMessageDeleted,
      },
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    const listeners = get().socketListeners;

    if (socket && listeners) {
      socket.off("newMessage", listeners.handleNewMessage);
      socket.off("userTyping", listeners.handleUserTyping);
      socket.off("userStoppedTyping", listeners.handleUserStoppedTyping);
      socket.off("messagesDelivered", listeners.handleMessagesDelivered);
      socket.off("messagesRead", listeners.handleMessagesRead);

      socket.off(
        "messageReactionUpdated",
        listeners.handleMessageReactionUpdated
      );

      socket.off("messageUpdated", listeners.handleMessageUpdated);
      socket.off("messageDeleted", listeners.handleMessageDeleted);
    }

    set({
      socketListeners: null,
      isTyping: false,
      replyingTo: null,
    });
  },
}));
