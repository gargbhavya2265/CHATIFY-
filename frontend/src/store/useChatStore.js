
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const getSelectedGroupStorageKey = () => {
    const userId = useAuthStore.getState().authUser?._id;
    return userId ? `chatify_selected_group_${userId}` : null;
};

export const useChatStore = create((set, get) => ({
    allContacts: [],
    chats: [],
    messages: [],
    groups: [],
    formerGroups: [],
    activeTab: "chats",
    selectedUser: null,
    selectedGroup: null,

    viewingProfile: null,
    isProfileLoading: false,

    isUsersLoading: false,
    isMessagesLoading: false,
    isGroupsLoading: false,
    isFormerGroupsLoading: false,
    isTyping: false,
    replyingTo: null,
    socketListeners: null,
    groupSocketListeners: null,
    groupCreatedListener: null,
    isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

    toggleSound: () => {
        localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
        set({ isSoundEnabled: !get().isSoundEnabled });
    },

    setActiveTab: (tab) => set({ activeTab: tab }),

    openUserProfile: async (userId) => {
        if (!userId) return;

        set({
            viewingProfile: null,
            isProfileLoading: true,
        });

        try {
            const res = await axiosInstance.get(`/users/${userId}/profile`);

            set({
                viewingProfile: res.data,
            });
        } catch (error) {
            toast.error(
                error.response?.data?.message || "Unable to load user profile"
            );
        } finally {
            set({ isProfileLoading: false });
        }
    },

    closeUserProfile: () => {
        set({
            viewingProfile: null,
            isProfileLoading: false,
        });
    },

    setSelectedUser: (selectedUser) => {
        get().unsubscribeFromGroupMessages();

        const storageKey = getSelectedGroupStorageKey();

        if (storageKey) {
            localStorage.removeItem(storageKey);
        }

        set({
            selectedUser,
            selectedGroup: null,
            isTyping: false,
            replyingTo: null,
            messages: [],
        });
    },

    setSelectedGroup: (selectedGroup) => {
        get().unsubscribeFromMessages();

        const storageKey = getSelectedGroupStorageKey();

        if (storageKey) {
            if (selectedGroup?._id) {
                localStorage.setItem(storageKey, selectedGroup._id);
            } else {
                localStorage.removeItem(storageKey);
            }
        }

        set({
            selectedGroup,
            selectedUser: null,
            activeTab: "groups",
            isTyping: false,
            replyingTo: null,
            messages: [],
        });
    },

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

    getMyGroups: async () => {
        set({ isGroupsLoading: true });

        try {
            const res = await axiosInstance.get("/groups");
            const responseData = res.data;

            const groupsList = Array.isArray(responseData)
                ? responseData
                : Array.isArray(responseData.groups)
                    ? responseData.groups
                    : Array.isArray(responseData.data)
                        ? responseData.data
                        : [];

            const storageKey = getSelectedGroupStorageKey();
            const savedGroupId = storageKey
                ? localStorage.getItem(storageKey)
                : null;

            const currentSelectedGroup = get().selectedGroup;

            const restoredGroup = savedGroupId
                ? groupsList.find(
                    (group) => group._id?.toString() === savedGroupId
                )
                : null;

            const updatedSelectedGroup = currentSelectedGroup
                ? groupsList.find(
                    (group) =>
                        group._id?.toString() === currentSelectedGroup._id?.toString()
                ) || null
                : restoredGroup || null;

            set({
                groups: groupsList,
                selectedGroup: updatedSelectedGroup,
                ...(updatedSelectedGroup ? { activeTab: "groups" } : {}),
            });

            if (savedGroupId && !restoredGroup && !currentSelectedGroup && storageKey) {
                localStorage.removeItem(storageKey);
            }
        } catch (error) {
            console.error("Error fetching groups:", error);

            toast.error(
                error.response?.data?.message || "Unable to fetch groups"
            );
        } finally {
            set({ isGroupsLoading: false });
        }
    },

    getMyFormerGroups: async () => {
        set({ isFormerGroupsLoading: true });

        try {
            const res = await axiosInstance.get("/groups/former");

            const formerGroups = Array.isArray(res.data.groups)
                ? res.data.groups
                : [];

            set({ formerGroups });
        } catch (error) {
            console.error("Error fetching archived groups:", error);

            toast.error(
                error.response?.data?.message ||
                "Unable to fetch archived groups"
            );
        } finally {
            set({ isFormerGroupsLoading: false });
        }
    },

    subscribeToGroupCreated: () => {
        const socket = useAuthStore.getState().socket;

        if (!socket) return;

        get().unsubscribeFromGroupCreated();

        const handleGroupCreated = (newGroup) => {
            if (!newGroup?._id) return;

            let alreadyExists = false;

            set((state) => {
                alreadyExists = state.groups.some(
                    (group) =>
                        group._id?.toString() === newGroup._id.toString()
                );

                return {
                    groups: alreadyExists
                        ? state.groups
                        : [newGroup, ...state.groups],
                    formerGroups: state.formerGroups.filter(
                        (group) =>
                            group._id?.toString() !== newGroup._id.toString()
                    ),
                };
            });

            if (!alreadyExists) {
                toast.success(`You were added to ${newGroup.name}`);
            }
        };

        socket.on("groupCreated", handleGroupCreated);

        set({
            groupCreatedListener: handleGroupCreated,
        });
    },

    unsubscribeFromGroupCreated: () => {
        const socket = useAuthStore.getState().socket;
        const listener = get().groupCreatedListener;

        if (socket && listener) {
            socket.off("groupCreated", listener);
        }

        set({
            groupCreatedListener: null,
        });
    },

    updateMemberRole: async (groupId, memberId, role) => {
        try {
            const res = await axiosInstance.patch(
                `/groups/${groupId}/members/${memberId}/role`,
                { role }
            );

            const updatedGroup = res.data.group;

            set((state) => ({
                groups: state.groups.map((group) =>
                    group._id === groupId ? updatedGroup : group
                ),
                selectedGroup:
                    state.selectedGroup?._id === groupId
                        ? updatedGroup
                        : state.selectedGroup,
            }));

            toast.success(res.data.message || "Member role updated successfully.");

            return true;
        } catch (error) {
            toast.error(
                error.response?.data?.message || "Unable to update member role."
            );

            return false;
        }
    },

    addGroupMembers: async (groupId, memberIds) => {
        try {
            const res = await axiosInstance.post(
                `/groups/${groupId}/members`,
                { memberIds }
            );

            const updatedGroup = res.data.group;

            set((state) => ({
                groups: state.groups.map((group) =>
                    group._id?.toString() === groupId.toString()
                        ? updatedGroup
                        : group
                ),
                formerGroups: state.formerGroups.filter(
                    (group) => group._id?.toString() !== groupId.toString()
                ),
                selectedGroup:
                    state.selectedGroup?._id?.toString() === groupId.toString()
                        ? updatedGroup
                        : state.selectedGroup,
            }));

            toast.success(res.data.message || "Members added successfully.");

            return true;
        } catch (error) {
            toast.error(
                error.response?.data?.message || "Unable to add members."
            );

            return false;
        }
    },

    removeGroupMember: async (groupId, memberId) => {
        try {
            const res = await axiosInstance.delete(
                `/groups/${groupId}/members/${memberId}`
            );

            const updatedGroup = res.data.group;

            set((state) => ({
                groups: state.groups.map((group) =>
                    group._id === groupId ? updatedGroup : group
                ),
                selectedGroup:
                    state.selectedGroup?._id === groupId
                        ? updatedGroup
                        : state.selectedGroup,
            }));

            toast.success(res.data.message || "Member removed successfully.");

            return true;
        } catch (error) {
            toast.error(
                error.response?.data?.message || "Unable to remove members."
            );

            return false;
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

    getGroupMessages: async (groupId) => {
        if (!groupId) return;

        set({
            isMessagesLoading: true,
            messages: [],
            replyingTo: null,
        });

        try {
            const res = await axiosInstance.get(`/messages/groups/${groupId}`);

            const messages = Array.isArray(res.data)
                ? res.data
                : res.data.messages || [];

            set({ messages });
        } catch (error) {
            console.error("Error fetching group messages:", error);

            toast.error(
                error.response?.data?.message || "Unable to fetch group messages"
            );
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

    sendGroupMessage: async (messageData) => {
        const { selectedGroup, messages, replyingTo } = get();
        const { authUser } = useAuthStore.getState();

        if (!selectedGroup || !authUser) return;

        const groupId = selectedGroup._id;
        const replyToId = replyingTo?._id || null;

        const payload = {
            ...messageData,
            ...(replyToId && { replyTo: replyToId }),
        };

        const tempId = `temp-${Date.now()}`;

        const optimisticMessage = {
            _id: tempId,
            messageType: "group",
            groupId,
            senderId: authUser,
            text: messageData.text,
            image: messageData.image,
            replyTo: replyingTo,
            readBy: [{ userId: authUser._id, readAt: new Date() }],
            createdAt: new Date().toISOString(),
            isOptimistic: true,
        };

        set({ messages: [...messages, optimisticMessage] });

        try {
            const res = await axiosInstance.post(
                `/messages/groups/${groupId}`,
                payload
            );

            const savedMessage = res.data.message || res.data;

            set((state) => ({
                messages: state.messages.map((message) =>
                    message._id === tempId ? savedMessage : message
                ),
                replyingTo:
                    state.replyingTo?._id === replyToId
                        ? null
                        : state.replyingTo,
            }));
        } catch (error) {
            set((state) => ({
                messages: state.messages.filter(
                    (message) => message._id !== tempId
                ),
            }));

            toast.error(
                error.response?.data?.message || "Unable to send group message"
            );
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

            if (get().selectedUser) {
                await get().getMyChatPartners();
            }
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

            if (get().selectedUser) {
                await get().getMyChatPartners();
            }
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
                        ? { ...message, status: "delivered" }
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

    subscribeToGroupMessages: () => {
        const { selectedGroup, isSoundEnabled } = get();

        if (!selectedGroup) return;

        const socket = useAuthStore.getState().socket;

        if (!socket) return;

        get().unsubscribeFromGroupMessages();

        const groupId = selectedGroup._id.toString();

        const handleNewGroupMessage = (newMessage) => {
            const messageGroupId = (
                newMessage.groupId?._id || newMessage.groupId
            )?.toString();

            if (messageGroupId !== groupId) return;

            const { authUser } = useAuthStore.getState();

            const senderId = (
                newMessage.senderId?._id || newMessage.senderId
            )?.toString();

            if (
                senderId === authUser?._id?.toString() &&
                !newMessage.isSystemMessage
            ) {
                return;
            }

            set((state) => {
                const alreadyExists = state.messages.some(
                    (message) => message._id === newMessage._id
                );

                if (alreadyExists) return state;

                return {
                    messages: [...state.messages, newMessage],
                };
            });

            if (isSoundEnabled) {
                const notificationSound = new Audio("/sounds/notification.mp3");
                notificationSound.currentTime = 0;

                notificationSound.play().catch((error) =>
                    console.log("Audio play failed:", error)
                );
            }
        };

        const updateGroupMessage = ({ message: updatedMessage } = {}) => {
            if (!updatedMessage?._id) return;

            const messageGroupId = (
                updatedMessage.groupId?._id || updatedMessage.groupId
            )?.toString();

            if (messageGroupId !== groupId) return;

            set((state) => ({
                messages: state.messages.map((message) =>
                    message._id === updatedMessage._id
                        ? updatedMessage
                        : message
                ),
            }));
        };

        const handleGroupUpdated = ({ group: updatedGroup } = {}) => {
            if (!updatedGroup?._id) return;

            set((state) => ({
                groups: state.groups.map((group) =>
                    group._id?.toString() === updatedGroup._id.toString()
                        ? updatedGroup
                        : group
                ),
                selectedGroup:
                    state.selectedGroup?._id?.toString() === updatedGroup._id.toString()
                        ? updatedGroup
                        : state.selectedGroup,
            }));
        };

        socket.on("newGroupMessage", handleNewGroupMessage);
        socket.on("messageUpdated", updateGroupMessage);
        socket.on("messageDeleted", updateGroupMessage);
        socket.on("messageReactionUpdated", updateGroupMessage);
        socket.on("groupUpdated", handleGroupUpdated);

        set({
            groupSocketListeners: {
                handleNewGroupMessage,
                updateGroupMessage,
                handleGroupUpdated,
            },
        });
    },

    unsubscribeFromGroupMessages: () => {
        const socket = useAuthStore.getState().socket;
        const listeners = get().groupSocketListeners;

        if (socket && listeners) {
            socket.off("newGroupMessage", listeners.handleNewGroupMessage);
            socket.off("messageUpdated", listeners.updateGroupMessage);
            socket.off("messageDeleted", listeners.updateGroupMessage);
            socket.off(
                "messageReactionUpdated",
                listeners.updateGroupMessage
            );
            socket.off("groupUpdated", listeners.handleGroupUpdated);
        }

        set({
            groupSocketListeners: null,
        });
    },
}));
