import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

let directMessagesRequestId = 0;

const getSelectedGroupStorageKey = () => {
    const userId = useAuthStore.getState().authUser?._id;
    return userId ? `chatify_selected_group_${userId}` : null;
};

const getSelectedChatStorageKey = () => {
    const userId = useAuthStore.getState().authUser?._id;
    return userId ? `chatify_selected_chat_${userId}` : null;
};

const updateProfileReferences = (value, updatedProfile) => {
    if (Array.isArray(value)) {
        return value.map((item) =>
            updateProfileReferences(item, updatedProfile)
        );
    }

    if (!value || typeof value !== "object" || value instanceof Date) {
        return value;
    }

    const updatedValue = Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
            key,
            updateProfileReferences(item, updatedProfile),
        ])
    );

    if (
        updatedValue._id?.toString() === updatedProfile._id?.toString()
    ) {
        return {
            ...updatedValue,
            ...updatedProfile,
        };
    }

    return updatedValue;
};

export const useChatStore = create((set, get) => ({
    allContacts: [],
    chats: [],
    messages: [],

    searchResults: [],
    isSearching: false,
    searchPagination: {
        page: 1,
        limit: 20,
        totalResults: 0,
        totalPages: 0,
        hasMore: false,
    },

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
    profileUpdatedListener: null,

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

        const groupStorageKey = getSelectedGroupStorageKey();
        const chatStorageKey = getSelectedChatStorageKey();

        if (groupStorageKey) {
            localStorage.removeItem(groupStorageKey);
        }

        if (chatStorageKey) {
            if (selectedUser?._id) {
                localStorage.setItem(chatStorageKey, selectedUser._id);
            } else {
                localStorage.removeItem(chatStorageKey);
            }
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

        const chatStorageKey = getSelectedChatStorageKey();

        if (chatStorageKey) {
            localStorage.removeItem(chatStorageKey);
        }

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
            const chats = res.data;

            const chatStorageKey = getSelectedChatStorageKey();
            const groupStorageKey = getSelectedGroupStorageKey();

            const savedChatId = chatStorageKey
                ? localStorage.getItem(chatStorageKey)
                : null;

            const savedGroupId = groupStorageKey
                ? localStorage.getItem(groupStorageKey)
                : null;

            const currentSelectedUser = get().selectedUser;
            const currentSelectedGroup = get().selectedGroup;

            let updatedSelectedUser = currentSelectedUser;

            if (!currentSelectedGroup && !savedGroupId) {
                if (currentSelectedUser) {
                    updatedSelectedUser =
                        chats.find(
                            (chat) =>
                                chat._id?.toString() ===
                                currentSelectedUser._id?.toString()
                        ) || null;
                } else if (savedChatId) {
                    updatedSelectedUser =
                        chats.find(
                            (chat) => chat._id?.toString() === savedChatId
                        ) || null;
                }

                if (savedChatId && !updatedSelectedUser && chatStorageKey) {
                    localStorage.removeItem(chatStorageKey);
                }
            }

            set((state) => ({
                chats,
                ...(updatedSelectedUser?._id?.toString() !==
                    state.selectedUser?._id?.toString()
                    ? { selectedUser: updatedSelectedUser }
                    : {}),
            }));
        } catch (error) {
            toast.error(
                error.response?.data?.message || "Something went wrong"
            );
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

            set((state) => ({
                groups: groupsList,
                selectedGroup: updatedSelectedGroup,
                ...(!currentSelectedGroup &&
                    restoredGroup &&
                    state.activeTab === "chats"
                    ? { activeTab: "groups" }
                    : {}),
            }));

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


    subscribeToProfileUpdates: () => {
        const socket = useAuthStore.getState().socket;

        if (!socket) return;

        get().unsubscribeFromProfileUpdates();

        const handleProfileUpdated = (updatedProfile = {}) => {
            if (!updatedProfile?._id) return;

            const updatedUserId = updatedProfile._id.toString();
            const currentAuthUser = useAuthStore.getState().authUser;

            if (currentAuthUser?._id?.toString() === updatedUserId) {
                useAuthStore.setState({
                    authUser: {
                        ...currentAuthUser,
                        ...updatedProfile,
                    },
                });
            }

            set((state) => ({
                allContacts: updateProfileReferences(
                    state.allContacts,
                    updatedProfile
                ),
                chats: updateProfileReferences(state.chats, updatedProfile),
                searchResults: updateProfileReferences(
                    state.searchResults,
                    updatedProfile
                ),
                selectedUser: updateProfileReferences(
                    state.selectedUser,
                    updatedProfile
                ),
                viewingProfile: updateProfileReferences(
                    state.viewingProfile,
                    updatedProfile
                ),
                messages: updateProfileReferences(
                    state.messages,
                    updatedProfile
                ),
                groups: updateProfileReferences(state.groups, updatedProfile),
                formerGroups: updateProfileReferences(
                    state.formerGroups,
                    updatedProfile
                ),
                selectedGroup: updateProfileReferences(
                    state.selectedGroup,
                    updatedProfile
                ),
            }));

            console.log(
                "Profile synchronized:",
                updatedProfile.fullName,
                updatedUserId
            );
        };

        socket.on("profileUpdated", handleProfileUpdated);

        set({
            profileUpdatedListener: handleProfileUpdated,
        });
    },

    unsubscribeFromProfileUpdates: () => {
        const socket = useAuthStore.getState().socket;
        const listener = get().profileUpdatedListener;

        if (socket && listener) {
            socket.off("profileUpdated", listener);
        }

        set({
            profileUpdatedListener: null,
        });
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

    updateGroupDetails: async (groupId, updates) => {
        try {
            const res = await axiosInstance.patch(
                `/groups/${groupId}`,
                updates
            );

            const updatedGroup = res.data.group;

            set((state) => ({
                groups: state.groups.map((group) =>
                    group._id?.toString() === groupId.toString()
                        ? updatedGroup
                        : group
                ),
                selectedGroup:
                    state.selectedGroup?._id?.toString() === groupId.toString()
                        ? updatedGroup
                        : state.selectedGroup,
            }));

            toast.success(
                res.data.message || "Group details updated successfully."
            );

            return true;
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                "Unable to update group details."
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

    leaveGroup: async (groupId) => {
        try {
            const res = await axiosInstance.post(
                `/groups/${groupId}/leave`
            );

            const formerGroup = {
                ...res.data.group,
                isFormerMember: true,
            };

            const storageKey = getSelectedGroupStorageKey();

            if (storageKey) {
                localStorage.removeItem(storageKey);
            }

            set((state) => ({
                groups: state.groups.filter(
                    (group) => group._id?.toString() !== groupId.toString()
                ),
                formerGroups: [
                    formerGroup,
                    ...state.formerGroups.filter(
                        (group) => group._id?.toString() !== groupId.toString()
                    ),
                ],
                selectedGroup:
                    state.selectedGroup?._id?.toString() === groupId.toString()
                        ? formerGroup
                        : state.selectedGroup,
                replyingTo: null,
            }));

            toast.success(
                res.data.message || "You left the group successfully."
            );

            return true;
        } catch (error) {
            toast.error(
                error.response?.data?.message || "Unable to leave group."
            );

            return false;
        }
    },

    getMessagesByUserId: async (userId) => {
        const requestId = ++directMessagesRequestId;
        const requestedUserId = userId.toString();

        set({ isMessagesLoading: true });

        try {
            const res = await axiosInstance.get(`/messages/${userId}`);

            const currentSelectedUserId = get().selectedUser?._id?.toString();

            if (
                requestId !== directMessagesRequestId ||
                currentSelectedUserId !== requestedUserId
            ) {
                return;
            }

            set({
                messages: res.data,
                replyingTo: null,
            });

            await get().getMyChatPartners();
        } catch (error) {
            if (requestId === directMessagesRequestId) {
                toast.error(
                    error.response?.data?.message || "Something went wrong"
                );
            }
        } finally {
            if (requestId === directMessagesRequestId) {
                set({ isMessagesLoading: false });
            }
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

    searchMessages: async (filters = {}, page = 1, append = false) => {
        set({ isSearching: true });

        try {
            const res = await axiosInstance.get("/messages/search", {
                params: {
                    ...filters,
                    page,
                    limit: 20,
                },
            });

            set((state) => ({
                searchResults: append
                    ? [...state.searchResults, ...res.data.results]
                    : res.data.results,
                searchPagination: res.data.pagination,
            }));

            return res.data;
        } catch (error) {
            toast.error(
                error.response?.data?.message || "Unable to search messages."
            );

            return null;
        } finally {
            set({ isSearching: false });
        }
    },

    clearSearch: () => {
        set({
            searchResults: [],
            isSearching: false,
            searchPagination: {
                page: 1,
                limit: 20,
                totalResults: 0,
                totalPages: 0,
                hasMore: false,
            },
        });
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

    sendVoiceMessage: async (audioBlob, duration) => {
        const { selectedUser, replyingTo } = get();
        const { authUser } = useAuthStore.getState();

        if (!selectedUser || !authUser || !audioBlob) return;

        const replyToId = replyingTo?._id || null;
        const tempId = `temp-voice-${Date.now()}`;

        const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
        const audioFile = new File(
            [audioBlob],
            `voice-message.${extension}`,
            { type: audioBlob.type || "audio/webm" }
        );

        const formData = new FormData();
        formData.append("audio", audioFile);
        formData.append("duration", String(duration));

        if (replyToId) {
            formData.append("replyTo", replyToId);
        }

        const optimisticMessage = {
            _id: tempId,
            senderId: authUser._id,
            receiverId: selectedUser._id,
            audio: {
                duration,
                mimeType: audioFile.type,
            },
            replyTo: replyingTo,
            status: "sent",
            createdAt: new Date().toISOString(),
            isOptimistic: true,
        };

        set((state) => ({
            messages: [...state.messages, optimisticMessage],
        }));

        try {
            const res = await axiosInstance.post(
                `/messages/voice/${selectedUser._id}`,
                formData
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

            toast.error(
                error.response?.data?.message || "Unable to send voice message"
            );
        }
    },

    sendGroupVoiceMessage: async (audioBlob, duration) => {
        const { selectedGroup, replyingTo } = get();
        const { authUser } = useAuthStore.getState();

        if (!selectedGroup || !authUser || !audioBlob) return;

        const groupId = selectedGroup._id;
        const replyToId = replyingTo?._id || null;
        const tempId = `temp-group-voice-${Date.now()}`;

        const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
        const audioFile = new File(
            [audioBlob],
            `group-voice-message.${extension}`,
            { type: audioBlob.type || "audio/webm" }
        );

        const formData = new FormData();
        formData.append("audio", audioFile);
        formData.append("duration", String(duration));

        if (replyToId) {
            formData.append("replyTo", replyToId);
        }

        const optimisticMessage = {
            _id: tempId,
            messageType: "group",
            groupId,
            senderId: authUser,
            audio: {
                duration,
                mimeType: audioFile.type,
            },
            replyTo: replyingTo,
            readBy: [{ userId: authUser._id, readAt: new Date() }],
            createdAt: new Date().toISOString(),
            isOptimistic: true,
        };

        set((state) => ({
            messages: [...state.messages, optimisticMessage],
        }));

        try {
            const res = await axiosInstance.post(
                `/messages/groups/${groupId}/voice`,
                formData
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
                error.response?.data?.message ||
                    "Unable to send group voice message"
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
                    (message) => message._id?.toString() === newMessage._id?.toString()
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
                    message._id?.toString() === updatedMessage._id.toString()
                        ? updatedMessage
                        : message
                ),
            }));
        };

        const handleGroupMessagesRead = ({
            groupId: eventGroupId,
            readerId,
            messageIds,
            readAt,
        } = {}) => {
            if (eventGroupId?.toString() !== groupId) return;

            if (!readerId || !Array.isArray(messageIds)) return;

            const readMessageIds = new Set(
                messageIds.map((id) => id.toString())
            );

            set((state) => ({
                messages: state.messages.map((message) => {
                    if (!readMessageIds.has(message._id?.toString())) {
                        return message;
                    }

                    const alreadyRead = message.readBy?.some((reader) => {
                        const existingReaderId = (
                            reader.userId?._id || reader.userId
                        )?.toString();

                        return existingReaderId === readerId.toString();
                    });

                    if (alreadyRead) return message;

                    return {
                        ...message,
                        readBy: [
                            ...(message.readBy || []),
                            {
                                userId: readerId,
                                readAt,
                            },
                        ],
                    };
                }),
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
        socket.on("groupMessagesRead", handleGroupMessagesRead);

        set({
            groupSocketListeners: {
                handleNewGroupMessage,
                updateGroupMessage,
                handleGroupUpdated,
                handleGroupMessagesRead,
            },
        });
    },

    unsubscribeFromGroupMessages: () => {
        const socket = useAuthStore.getState().socket;
        const listeners = get().groupSocketListeners;

        if (socket && listeners) {
            socket.off(
                "newGroupMessage",
                listeners.handleNewGroupMessage
            );

            socket.off(
                "messageUpdated",
                listeners.updateGroupMessage
            );

            socket.off(
                "messageDeleted",
                listeners.updateGroupMessage
            );

            socket.off(
                "messageReactionUpdated",
                listeners.updateGroupMessage
            );

            socket.off(
                "groupUpdated",
                listeners.handleGroupUpdated
            );

            socket.off(
                "groupMessagesRead",
                listeners.handleGroupMessagesRead
            );
        }

        set({
            groupSocketListeners: null,
        });
    },
}));
