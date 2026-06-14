import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";


let messageHandler = null;
export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error loading contacts");
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
      toast.error(error.response?.data?.message || "Error loading chats");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const { authUser } = useAuthStore.getState();

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      createdAt: new Date().toISOString(),
    };

    // optimistic update
    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );

      // replace optimistic with real message
      set((state) => ({
        messages: state.messages
          .filter((msg) => msg._id !== tempId)
          .concat(res.data),
      }));
    } catch (error) {
      // rollback
      set({ messages: messages });
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  // 🔥 REALTIME FIXED VERSION

subscribeToMessages: () => {
  const socket = useAuthStore.getState().socket;
  if (!socket) return;

  const { isSoundEnabled } = get();

  if (messageHandler) {
    socket.off("newMessage", messageHandler);
  }

  messageHandler = (newMessage) => {
    const currentChatUser = get().selectedUser;
    if (!currentChatUser) return;

    const isRelevant =
      newMessage.senderId === currentChatUser._id ||
      newMessage.receiverId === currentChatUser._id;

    if (!isRelevant) return;

    set((state) => {
      const exists = state.messages.some(m => m._id === newMessage._id);
      if (exists) return state;
      return { messages: [...state.messages, newMessage] };
    });

    if (isSoundEnabled) {
      const audio = new Audio("/sounds/notification.mp3");
      audio.play().catch(() => {});
    }
  };

  socket.on("newMessage", messageHandler);
},

unsubscribeFromMessages: () => {
  const socket = useAuthStore.getState().socket;
  if (socket && messageHandler) {
    socket.off("newMessage", messageHandler);
  }
},
}));