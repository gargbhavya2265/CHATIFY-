
import { Fragment, useEffect, useRef, useState } from "react";
import {
  XIcon,
  Users,
  Reply,
  Pencil,
  Trash2,
  Smile,
  Crown,
  UserPlus,
  UserMinus,
  Search,
  LogOut,
  ShieldCheck,
  Info,
  Camera,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";

import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import GroupMessageInput from "./GroupMessageInput";
import VoiceMessagePlayer from "./VoiceMessagePlayer";

function GroupChatContainer() {
  const {
    selectedGroup,
    setSelectedGroup,
    messages,
    isMessagesLoading,
    getGroupMessages,
    subscribeToGroupMessages,
    unsubscribeFromGroupMessages,
    toggleReaction,
    setReplyingTo,
    editMessage,
    deleteMessage,
    updateMemberRole,
    updateGroupDetails,
    allContacts,
    getAllContacts,
    addGroupMembers,
    removeGroupMember,
    leaveGroup,
    openUserProfile,
    viewingProfile,
  } = useChatStore();

  const { authUser } = useAuthStore();

  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showGroupPicPreview, setShowGroupPicPreview] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);

  const [groupName, setGroupName] = useState(selectedGroup?.name || "");
  const [groupDescription, setGroupDescription] = useState(
    selectedGroup?.description || ""
  );
  const [isSavingGroupInfo, setIsSavingGroupInfo] = useState(false);
  const [isUploadingGroupPic, setIsUploadingGroupPic] = useState(false);

  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState([]);
  const [contactSearch, setContactSearch] = useState("");
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedText, setEditedText] = useState("");

  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const hasInitialScrollRef = useRef(false);
  const hasObservedLoadingRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const pickerRef = useRef(null);
  const groupPicInputRef = useRef(null);

  const groupId = selectedGroup?._id;
  const isFormerMember = selectedGroup?.isFormerMember === true;

  // Calculate unread messages before the scroll effect uses firstUnreadMessageId.
  const unreadMessages = isFormerMember
    ? []
    : (messages || []).filter(
        (message) =>
          message.wasUnreadBeforeOpening && !message.isSystemMessage
      );

  const firstUnreadMessageId = unreadMessages[0]?._id?.toString();
  const unreadCount = unreadMessages.length;

  useEffect(() => {
    if (!groupId) return;

    hasObservedLoadingRef.current = false;
    hasInitialScrollRef.current = false;
    isNearBottomRef.current = true;

    getGroupMessages(groupId);
    subscribeToGroupMessages();

    return () => {
      unsubscribeFromGroupMessages();
    };
  }, [
    groupId,
    getGroupMessages,
    subscribeToGroupMessages,
    unsubscribeFromGroupMessages,
  ]);

  useEffect(() => {
    if (isMessagesLoading) {
      hasObservedLoadingRef.current = true;
      return;
    }

    if (!hasObservedLoadingRef.current) return;

    if (!hasInitialScrollRef.current) {
      const firstUnreadElement = firstUnreadMessageId
        ? document.getElementById(`group-message-${firstUnreadMessageId}`)
        : null;

      if (firstUnreadElement) {
        firstUnreadElement.scrollIntoView({
          behavior: "auto",
          block: "center",
        });
        isNearBottomRef.current = false;
      } else {
        bottomRef.current?.scrollIntoView({
          behavior: "auto",
          block: "end",
        });
        isNearBottomRef.current = true;
      }

      hasInitialScrollRef.current = true;
      return;
    }

    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, isMessagesLoading, firstUnreadMessageId]);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key !== "Escape" || viewingProfile) return;

      if (showGroupPicPreview) {
        setShowGroupPicPreview(false);
      } else if (showLeaveConfirmation) {
        setShowLeaveConfirmation(false);
      } else if (showAddMembers) {
        setShowAddMembers(false);
      } else if (showMembers) {
        setShowMembers(false);
      } else if (showGroupInfo) {
        setShowGroupInfo(false);
      } else {
        setSelectedGroup(null);
      }
    };

    window.addEventListener("keydown", handleEscKey);

    return () => {
      window.removeEventListener("keydown", handleEscKey);
    };
  }, [
    setSelectedGroup,
    showMembers,
    showAddMembers,
    showLeaveConfirmation,
    showGroupInfo,
    showGroupPicPreview,
    viewingProfile,
  ]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target)
      ) {
        setShowReactionPicker(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!selectedGroup) return null;

  const members = selectedGroup.members || [];
  const contacts = allContacts || [];

  const getUserId = (user) => {
    if (!user) return null;
    return (user._id || user).toString();
  };

  const currentUserId = getUserId(authUser);

  const currentMember = members.find(
    (member) => getUserId(member.userId) === currentUserId
  );

  const isCurrentUserAdmin =
    !isFormerMember && currentMember?.role === "admin";

  const isCurrentUserModerator =
    !isFormerMember && currentMember?.role === "moderator";

  const adminCount = members.filter(
    (member) => member.role === "admin"
  ).length;

  const cannotLeaveGroup =
    isCurrentUserAdmin && adminCount === 1;

  const canDeleteAnyMessage =
    isCurrentUserAdmin || isCurrentUserModerator;

  const getMemberUser = (member) => {
    return member?.userId && typeof member.userId === "object"
      ? member.userId
      : null;
  };

  const findGroupMember = (userId) => {
    const id = getUserId(userId);

    return members.find(
      (member) => getUserId(member.userId) === id
    );
  };

  const getSender = (message) => {
    const senderId = getUserId(message.senderId);

    if (
      message.senderId &&
      typeof message.senderId === "object" &&
      message.senderId.fullName
    ) {
      return message.senderId;
    }

    return getMemberUser(findGroupMember(senderId));
  };

  const getSenderName = (senderId) => {
    if (
      senderId &&
      typeof senderId === "object" &&
      senderId.fullName
    ) {
      return senderId.fullName;
    }

    const member = findGroupMember(senderId);
    const user = getMemberUser(member);

    return user?.fullName || "Group member";
  };

  const isOwnMessage = (message) => {
    return getUserId(message.senderId) === currentUserId;
  };

  const handleProfileClick = (event, userId) => {
    event.stopPropagation();

    const id = getUserId(userId);

    if (!id) return;

    openUserProfile(id);
  };

  // GROUP INFO HANDLERS

  const handleOpenGroupInfo = () => {
    setGroupName(selectedGroup.name || "");
    setGroupDescription(selectedGroup.description || "");
    setShowGroupInfo(true);
  };

  const handleSaveGroupInfo = async () => {
    if (!isCurrentUserAdmin || isSavingGroupInfo) return;

    const trimmedName = groupName.trim();
    const trimmedDescription = groupDescription.trim();

    if (trimmedName.length < 3 || trimmedName.length > 50) {
      return;
    }

    if (trimmedDescription.length > 500) {
      return;
    }

    const updates = {};

    if (trimmedName !== selectedGroup.name) {
      updates.name = trimmedName;
    }

    if (
      trimmedDescription !== (selectedGroup.description || "")
    ) {
      updates.description = trimmedDescription;
    }

    if (Object.keys(updates).length === 0) {
      setShowGroupInfo(false);
      return;
    }

    setIsSavingGroupInfo(true);

    try {
      const success = await updateGroupDetails(groupId, updates);

      if (success) {
        setShowGroupInfo(false);
      }
    } finally {
      setIsSavingGroupInfo(false);
    }
  };

  const handleGroupPicChange = (event) => {
    const file = event.target.files?.[0];

    if (!file || !isCurrentUserAdmin || isUploadingGroupPic) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onloadend = async () => {
      if (typeof reader.result !== "string") return;

      setIsUploadingGroupPic(true);

      try {
        await updateGroupDetails(groupId, {
          groupPic: reader.result,
        });
      } finally {
        setIsUploadingGroupPic(false);
        event.target.value = "";
      }
    };

    reader.onerror = () => {
      setIsUploadingGroupPic(false);
      event.target.value = "";
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveGroupPic = async () => {
    if (!isCurrentUserAdmin || isUploadingGroupPic) return;

    setIsUploadingGroupPic(true);

    try {
      await updateGroupDetails(groupId, {
        groupPic: "",
      });
    } finally {
      setIsUploadingGroupPic(false);
    }
  };

  // MESSAGE HANDLERS

  const handleEdit = async (messageId) => {
    if (isFormerMember || !editedText.trim()) return;

    await editMessage(messageId, editedText.trim());

    setEditingMessageId(null);
    setEditedText("");
  };

  const handleDelete = async (messageId) => {
    if (isFormerMember) return;

    if (!window.confirm("Delete this message?")) return;

    await deleteMessage(messageId);
  };

  const handleReaction = (messageId, emoji) => {
    if (isFormerMember) return;

    toggleReaction(messageId, emoji);
    setShowReactionPicker(null);
  };

  const handleReply = (message) => {
    if (isFormerMember) return;

    setReplyingTo(message);
    setShowReactionPicker(null);
  };

  const handleEditClick = (message) => {
    if (isFormerMember || !isOwnMessage(message)) return;

    setEditingMessageId(message._id);
    setEditedText(message.text || "");
    setShowReactionPicker(null);
  };

  const handleRoleChange = async (memberId, role) => {
    if (
      isFormerMember ||
      !isCurrentUserAdmin ||
      memberId === currentUserId
    ) {
      return;
    }

    await updateMemberRole(selectedGroup._id, memberId, role);
  };

  const handleOpenAddMembers = async () => {
    if (isFormerMember || !isCurrentUserAdmin) return;

    setShowAddMembers(true);
    setSelectedNewMemberIds([]);
    setContactSearch("");

    await getAllContacts();
  };

  const toggleNewMember = (userId) => {
    if (isFormerMember) return;

    setSelectedNewMemberIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId]
    );
  };

  const handleAddMembers = async () => {
    if (
      isFormerMember ||
      !isCurrentUserAdmin ||
      selectedNewMemberIds.length === 0 ||
      isAddingMembers
    ) {
      return;
    }

    setIsAddingMembers(true);

    try {
      const success = await addGroupMembers(
        selectedGroup._id,
        selectedNewMemberIds
      );

      if (success) {
        setShowAddMembers(false);
        setSelectedNewMemberIds([]);
      }
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (
      isFormerMember ||
      !isCurrentUserAdmin ||
      memberId === currentUserId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${memberName} from ${selectedGroup.name}?`
    );

    if (!confirmed) return;

    await removeGroupMember(selectedGroup._id, memberId);
  };

  const handleLeaveGroup = async () => {
    if (
      isFormerMember ||
      !groupId ||
      isLeavingGroup ||
      cannotLeaveGroup
    ) {
      return;
    }

    setIsLeavingGroup(true);

    try {
      const success = await leaveGroup(groupId);

      if (success) {
        setShowLeaveConfirmation(false);
        setShowMembers(false);
      }
    } finally {
      setIsLeavingGroup(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDateKey = (date) => {
    const messageDate = new Date(date);

    return `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`;
  };

  const getDateLabel = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1);

    if (getDateKey(messageDate) === getDateKey(today)) {
      return "Today";
    }

    if (getDateKey(messageDate) === getDateKey(yesterday)) {
      return "Yesterday";
    }

    return messageDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getRoleLabel = (role) => {
    if (!role) return "Member";

    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getSystemEventDetails = (message) => {
    const eventConfig = {
      members_added: {
        icon: UserPlus,
        color: "text-emerald-400",
        text: "Member added",
      },
      member_removed: {
        icon: UserMinus,
        color: "text-red-400",
        text: "Member removed",
      },
      member_left: {
        icon: LogOut,
        color: "text-amber-400",
        text: "Member left the group",
      },
      role_updated: {
        icon: ShieldCheck,
        color: "text-cyan-400",
        text: "Member role updated",
      },
    };

    return (
      eventConfig[message.systemEvent] || {
        icon: Users,
        color: "text-slate-400",
        text: "Group activity",
      }
    );
  };

  const existingMemberIds = new Set(
    members.map((member) => getUserId(member.userId))
  );

  const availableContacts = contacts.filter((contact) => {
    const contactId = getUserId(contact);

    if (!contactId || existingMemberIds.has(contactId)) {
      return false;
    }

    const search = contactSearch.trim().toLowerCase();

    if (!search) return true;

    return (
      contact.fullName?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-slate-900/50 backdrop-blur-sm">
      {/* Group Header */}
      <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 min-h-[84px] px-6 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (selectedGroup.groupPic) {
                setShowGroupPicPreview(true);
              }
            }}
            disabled={!selectedGroup.groupPic}
            aria-label="View group picture"
            className={`w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center overflow-hidden shrink-0 ${
              selectedGroup.groupPic
                ? "cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all"
                : "cursor-default"
            }`}
          >
            {selectedGroup.groupPic ? (
              <img
                src={selectedGroup.groupPic}
                alt={selectedGroup.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Users className="w-6 h-6 text-cyan-400" />
            )}
          </button>

          <div className="min-w-0">
            <h3 className="text-slate-200 font-medium truncate">
              {selectedGroup.name}
            </h3>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMembers(true)}
                className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
              >
                {members.length} members
              </button>

              <button
                onClick={handleOpenGroupInfo}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" />
                Group Info
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setSelectedGroup(null)}
          className="p-2 shrink-0"
          title="Close group"
        >
          <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
        </button>
      </div>

      {/* Archived Group Banner */}
      {isFormerMember && (
        <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
          <span className="text-xl">📦</span>
          <div>
            <p className="text-sm font-medium text-amber-300">
              Archived Group · Read-only
            </p>
            <p className="text-xs text-slate-400">
              You can view previous messages but cannot send new messages or
              manage this group.
            </p>
          </div>
        </div>
      )}

      {/* Group Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={(event) => {
          const { scrollHeight, scrollTop, clientHeight } =
            event.currentTarget;
          isNearBottomRef.current =
            scrollHeight - scrollTop - clientHeight < 120;
        }}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
      >
        {isMessagesLoading ? (
          <div className="flex justify-center items-center h-full">
            <span className="loading loading-spinner loading-lg text-cyan-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-center">
            <Users className="w-12 h-12 text-slate-600 mb-3" />

            <h3 className="text-slate-300 font-medium">
              {isFormerMember
                ? "No previous messages"
                : `Welcome to ${selectedGroup.name}`}
            </h3>

            <p className="text-slate-500 text-sm mt-1">
              {isFormerMember
                ? "There are no messages available in this group."
                : "Start the conversation with your group."}
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const previousMessage = messages[index - 1];

            const showDateSeparator =
              !previousMessage ||
              getDateKey(previousMessage.createdAt) !==
                getDateKey(message.createdAt);

            const dateSeparator = showDateSeparator ? (
              <div className="flex justify-center py-3">
                <span className="text-xs font-medium text-slate-400 bg-slate-800/80 border border-slate-700/70 rounded-full px-3 py-1">
                  {getDateLabel(message.createdAt)}
                </span>
              </div>
            ) : null;

            const unreadDivider =
              message._id?.toString() === firstUnreadMessageId ? (
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-cyan-500/50" />
                  <span className="text-xs font-medium text-cyan-400 whitespace-nowrap">
                    {unreadCount} unread{" "}
                    {unreadCount === 1 ? "message" : "messages"}
                  </span>
                  <div className="flex-1 h-px bg-cyan-500/50" />
                </div>
              ) : null;

            if (message.isSystemMessage) {
              const eventDetails = getSystemEventDetails(message);
              const EventIcon = eventDetails.icon;

              return (
                <Fragment key={message._id}>
                  {dateSeparator}
                  {unreadDivider}

                  <div className="flex justify-center w-full py-2">
                    <div className="flex items-center gap-2 max-w-[85%] px-4 py-2.5 rounded-full bg-slate-800/80 border border-slate-700/70 shadow-sm">
                      <EventIcon
                        className={`w-4 h-4 shrink-0 ${eventDetails.color}`}
                      />

                      <p className="text-xs sm:text-sm text-slate-300 text-center break-words">
                        {message.text || eventDetails.text}
                      </p>

                      <span className="text-[10px] text-slate-500 shrink-0">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                </Fragment>
              );
            }

            const own = isOwnMessage(message);
            const sender = getSender(message);
            const deleted = message.isDeleted;
            const replyMessage = message.replyTo;

            const canReply =
              !isFormerMember && !deleted && !editingMessageId;

            const canEdit =
              own &&
              !isFormerMember &&
              !deleted &&
              Boolean(message.text);

            const canDelete =
              !isFormerMember &&
              !deleted &&
              (own || canDeleteAnyMessage);

            const canReact = !isFormerMember && !deleted;

            const showToolbar =
              canReply || canEdit || canDelete || canReact;

            return (
              <Fragment key={message._id}>
                {dateSeparator}
                {unreadDivider}

                <div
                  id={`group-message-${message._id}`}
                  className={`flex gap-2 overflow-visible group/message ${
                    own ? "justify-end" : "justify-start"
                  }`}
                >
                  {!own && (
                    <button
                      type="button"
                      onClick={(event) =>
                        handleProfileClick(event, message.senderId)
                      }
                      aria-label={`View ${
                        sender?.fullName || "member"
                      }'s profile`}
                      className="w-9 h-9 rounded-full overflow-hidden bg-slate-700 shrink-0 mt-5 cursor-pointer"
                    >
                      <img
                        src={sender?.profilePic || "/avatar.png"}
                        alt={sender?.fullName || "Member"}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}

                  <div
                    className={`max-w-[75%] min-w-0 ${
                      own ? "items-end" : "items-start"
                    } flex flex-col`}
                  >
                    {!own && (
                      <button
                        type="button"
                        onClick={(event) =>
                          handleProfileClick(event, message.senderId)
                        }
                        className="text-xs text-cyan-400 mb-1 ml-1 hover:text-cyan-300 transition-colors"
                      >
                        {getSenderName(message.senderId)}
                      </button>
                    )}

                    <div
                      className={`relative rounded-2xl px-4 py-3 ${
                        own
                          ? "bg-cyan-600 text-white rounded-br-sm"
                          : "bg-slate-800 text-slate-200 rounded-bl-sm"
                      }`}
                    >
                      {/* Floating Message Toolbar */}
                      {showToolbar && (
                        <div
                          className={`absolute -top-12 z-40 flex items-center gap-1 p-1.5 rounded-xl border border-slate-600/70 bg-slate-900/95 backdrop-blur-xl shadow-xl transition-all duration-200 opacity-100 md:opacity-0 md:group-hover/message:opacity-100 md:group-focus-within/message:opacity-100 ${
                            own ? "right-0" : "left-0"
                          }`}
                        >
                          {/* React */}
                          {canReact && (
                            <div className="relative" ref={pickerRef}>
                              <button
                                type="button"
                                onClick={() =>
                                  setShowReactionPicker(
                                    showReactionPicker === message._id
                                      ? null
                                      : message._id
                                  )
                                }
                                title="React"
                                aria-label="React to message"
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                                  showReactionPicker === message._id
                                    ? "bg-cyan-500/20 text-cyan-300"
                                    : "text-slate-300 hover:bg-slate-700 hover:text-cyan-300"
                                }`}
                              >
                                <Smile className="w-4 h-4" />
                              </button>

                              {showReactionPicker === message._id && (
                                <div
                                  className={`absolute top-full mt-2 z-[100] ${
                                    own ? "right-0" : "left-0"
                                  }`}
                                >
                                  <EmojiPicker
                                    onEmojiClick={(emojiData) =>
                                      handleReaction(
                                        message._id,
                                        emojiData.emoji
                                      )
                                    }
                                    theme="dark"
                                    height={350}
                                    width={300}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Reply - incoming messages */}
                          {!own && canReply && (
                            <button
                              type="button"
                              onClick={() => handleReply(message)}
                              title="Reply"
                              aria-label="Reply to message"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700 hover:text-cyan-300 transition-colors"
                            >
                              <Reply className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit - own messages */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleEditClick(message)}
                              title="Edit"
                              aria-label="Edit message"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700 hover:text-cyan-300 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(message._id)}
                              title="Delete"
                              aria-label="Delete message"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Reply Preview */}
                      {replyMessage && (
                        <div className="mb-2 p-2 rounded-lg bg-black/20 border-l-2 border-cyan-400">
                          <p className="text-xs font-medium text-cyan-300 mb-1">
                            {getSenderName(replyMessage.senderId)}
                          </p>

                          {replyMessage.image ? (
                            <div className="flex items-start gap-2 min-w-0">
                              <img
                                src={replyMessage.image}
                                alt="Replied image"
                                className="w-12 h-12 rounded-md object-cover shrink-0"
                              />

                              {replyMessage.text && (
                                <p className="text-xs opacity-80 whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 flex-1">
                                  {replyMessage.text}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs opacity-80 whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">
                              {replyMessage.audio
                                ? "🎤 Voice message"
                                : replyMessage.text || "Message unavailable"}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Message Content */}
                      {deleted ? (
                        <p className="italic text-sm opacity-70">
                          {message.deletedBy
                            ? `This message was deleted by ${getSenderName(
                                message.deletedBy
                              )}`
                            : "This message was deleted"}
                        </p>
                      ) : (
                        <>
                          {message.image && (
                            <img
                              src={message.image}
                              alt="Shared image"
                              className="rounded-lg max-h-64 object-cover mb-2"
                            />
                          )}

                          {/* Voice Message */}
                          {message.audio?.url && (
                            <div className="my-1 w-[280px] min-w-0 max-w-full">
                              <VoiceMessagePlayer
                                src={message.audio.url}
                                isOwnMessage={own}
                              />
                            </div>
                          )}

                          {editingMessageId === message._id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editedText}
                                onChange={(event) =>
                                  setEditedText(event.target.value)
                                }
                                className="w-full min-w-[180px] bg-slate-900/50 text-white rounded-lg p-2 outline-none resize-none"
                                rows={2}
                                maxLength={2000}
                              />

                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditedText("");
                                  }}
                                  className="text-xs text-slate-300 hover:text-white"
                                >
                                  Cancel
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEdit(message._id)}
                                  disabled={!editedText.trim()}
                                  className="text-xs font-medium text-cyan-300 disabled:opacity-40"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            message.text && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.text}
                              </p>
                            )
                          )}
                        </>
                      )}


                      <div className="flex items-center justify-end gap-1 mt-1">
                        {message.isEdited && (
                          <span className="text-[10px] opacity-60">
                            edited
                          </span>
                        )}

                        <span className="text-[10px] opacity-60">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Reactions */}
                    {message.reactions?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.reactions.map((reaction, reactionIndex) => (
                          <button
                            key={`${reaction.emoji}-${reactionIndex}`}
                            type="button"
                            disabled={isFormerMember}
                            onClick={() =>
                              handleReaction(message._id, reaction.emoji)
                            }
                            className="text-xs bg-slate-800 border border-slate-700 rounded-full px-2 py-1 hover:border-cyan-500/50 transition-colors disabled:cursor-default"
                          >
                            {reaction.emoji} {reaction.users?.length || 0}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      {/* Group Message Composer */}
      {!isFormerMember ? (
        <div className="shrink-0 w-full">
          <GroupMessageInput />
        </div>
      ) : (
        <div className="shrink-0 w-full border-t border-slate-700 bg-slate-800/50 px-4 py-4 text-center">
          <p className="text-sm text-slate-400">
            You left this group or were removed. Sending messages is disabled.
          </p>
        </div>
      )}

      {/* GROUP INFO MODAL */}
      {showGroupInfo && (
        <div
          className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!isSavingGroupInfo && !isUploadingGroupPic) {
              setShowGroupInfo(false);
            }
          }}
        >
          <div
            className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-slate-100 font-semibold">
                  Group Information
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  View and manage group details
                </p>
              </div>

              <button
                onClick={() => setShowGroupInfo(false)}
                disabled={isSavingGroupInfo || isUploadingGroupPic}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-40"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Group Picture */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedGroup.groupPic) {
                      setShowGroupPicPreview(true);
                    }
                  }}
                  disabled={!selectedGroup.groupPic}
                  aria-label="View group picture"
                  className={`relative w-24 h-24 rounded-full overflow-hidden bg-cyan-500/10 border-2 border-slate-600 ${
                    selectedGroup.groupPic
                      ? "cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all"
                      : "cursor-default"
                  }`}
                >
                  {selectedGroup.groupPic ? (
                    <img
                      src={selectedGroup.groupPic}
                      alt={selectedGroup.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-10 h-10 text-cyan-400" />
                    </div>
                  )}

                  {isUploadingGroupPic && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="loading loading-spinner loading-md text-white" />
                    </div>
                  )}
                </button>

                {isCurrentUserAdmin && (
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => groupPicInputRef.current?.click()}
                      disabled={isUploadingGroupPic}
                      className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      {selectedGroup.groupPic
                        ? "Change Picture"
                        : "Add Group Picture"}
                    </button>

                    {selectedGroup.groupPic && (
                      <button
                        onClick={handleRemoveGroupPic}
                        disabled={isUploadingGroupPic}
                        className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={groupPicInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleGroupPicChange}
                  className="hidden"
                />

                <p className="text-xs text-slate-500 mt-2">
                  {selectedGroup.groupPic
                    ? "Click the picture to view it"
                    : "Maximum image size: 5 MB"}
                </p>
              </div>

              {/* Group Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Group Name
                </label>

                <input
                  type="text"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  disabled={!isCurrentUserAdmin}
                  maxLength={50}
                  placeholder="Enter group name"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-400 disabled:opacity-70"
                />

                {isCurrentUserAdmin && (
                  <p className="text-xs text-slate-500 mt-1">
                    {groupName.length}/50 characters · Minimum 3
                  </p>
                )}
              </div>

              {/* Group Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>

                <textarea
                  value={groupDescription}
                  onChange={(event) =>
                    setGroupDescription(event.target.value)
                  }
                  disabled={!isCurrentUserAdmin}
                  maxLength={500}
                  rows={4}
                  placeholder="Add a description for your group..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none resize-none focus:border-cyan-400 disabled:opacity-70"
                />

                {isCurrentUserAdmin && (
                  <p className="text-xs text-slate-500 mt-1 text-right">
                    {groupDescription.length}/500
                  </p>
                )}
              </div>

              {/* Group Details */}
              <div className="bg-slate-900/60 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total members</span>
                  <span className="text-slate-200 font-medium">
                    {members.length}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Created by</span>
                  <span className="text-slate-200 font-medium">
                    {selectedGroup.createdBy?.fullName || "Unknown"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Your role</span>
                  <span className="text-cyan-400 font-medium">
                    {isFormerMember
                      ? "Former member"
                      : getRoleLabel(currentMember?.role)}
                  </span>
                </div>
              </div>

              {!isCurrentUserAdmin && !isFormerMember && (
                <p className="text-xs text-slate-400 text-center">
                  Only group admins can edit group information.
                </p>
              )}
            </div>

            {isCurrentUserAdmin && (
              <div className="flex gap-3 p-4 border-t border-slate-700">
                <button
                  onClick={() => setShowGroupInfo(false)}
                  disabled={isSavingGroupInfo || isUploadingGroupPic}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSaveGroupInfo}
                  disabled={
                    isSavingGroupInfo ||
                    isUploadingGroupPic ||
                    groupName.trim().length < 3 ||
                    groupName.trim().length > 50 ||
                    groupDescription.length > 500
                  }
                  className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
                >
                  {isSavingGroupInfo ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Picture Full-Size Preview */}
      {showGroupPicPreview && selectedGroup.groupPic && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowGroupPicPreview(false)}
        >
          <button
            type="button"
            onClick={() => setShowGroupPicPreview(false)}
            aria-label="Close picture preview"
            className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>

          <div
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={selectedGroup.groupPic}
              alt={`${selectedGroup.name} group picture`}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />

            <p className="text-slate-300 text-sm mt-3">
              {selectedGroup.name}
            </p>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembers && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowMembers(false)}
        >
          <div
            className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-slate-100 font-semibold">
                  Group Members
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  {members.length} members in {selectedGroup.name}
                </p>
              </div>

              <button
                onClick={() => setShowMembers(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {isCurrentUserAdmin && (
              <div className="p-3 border-b border-slate-700">
                <button
                  onClick={handleOpenAddMembers}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Members
                </button>
              </div>
            )}

            <div className="max-h-[400px] overflow-y-auto p-3 space-y-2">
              {members.map((member) => {
                const user = getMemberUser(member);
                const memberId = getUserId(member.userId);
                const isAdmin = member.role === "admin";
                const isModerator = member.role === "moderator";

                return (
                  <div
                    key={memberId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/40"
                  >
                    <button
                      type="button"
                      onClick={(event) =>
                        handleProfileClick(event, member.userId)
                      }
                      aria-label={`View ${
                        user?.fullName || "member"
                      }'s profile`}
                      className="w-11 h-11 rounded-full overflow-hidden bg-slate-600 shrink-0 cursor-pointer"
                    >
                      <img
                        src={user?.profilePic || "/avatar.png"}
                        alt={user?.fullName || "Member"}
                        className="w-full h-full object-cover"
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(event) =>
                          handleProfileClick(event, member.userId)
                        }
                        className="text-sm font-medium text-slate-100 truncate hover:text-cyan-400 transition-colors"
                      >
                        {user?.fullName || "Group member"}

                        {memberId === currentUserId && (
                          <span className="text-xs text-slate-400 ml-2">
                            (You)
                          </span>
                        )}
                      </button>

                      <p className="text-xs text-slate-400">
                        {getRoleLabel(member.role)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(isAdmin || isModerator) && (
                        <div className="flex items-center gap-1 text-xs text-cyan-400">
                          {isAdmin && <Crown className="w-4 h-4" />}
                          {getRoleLabel(member.role)}
                        </div>
                      )}

                      {isCurrentUserAdmin &&
                        memberId !== currentUserId && (
                          <>
                            <select
                              value={member.role}
                              onChange={(event) =>
                                handleRoleChange(
                                  memberId,
                                  event.target.value
                                )
                              }
                              className="bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-2 outline-none focus:border-cyan-400"
                            >
                              <option value="admin">Admin</option>
                              <option value="moderator">Moderator</option>
                              <option value="member">Member</option>
                            </select>

                            <button
                              onClick={() =>
                                handleRemoveMember(
                                  memberId,
                                  user?.fullName || "this member"
                                )
                              }
                              title="Remove member"
                              className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leave Group */}
            {!isFormerMember && (
              <div className="p-4 border-t border-slate-700">
                {cannotLeaveGroup && (
                  <p className="text-xs text-amber-300 mb-3 text-center">
                    You are the only admin. Promote another member to admin
                    before leaving.
                  </p>
                )}

                <button
                  onClick={() => setShowLeaveConfirmation(true)}
                  disabled={isLeavingGroup || cannotLeaveGroup}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Group
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Group Confirmation Modal */}
      {showLeaveConfirmation && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!isLeavingGroup) {
              setShowLeaveConfirmation(false);
            }
          }}
        >
          <div
            className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl shadow-xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
              <LogOut className="w-6 h-6 text-red-400" />
            </div>

            <h3 className="text-lg font-semibold text-slate-100 text-center">
              Leave {selectedGroup.name}?
            </h3>

            <p className="text-sm text-slate-400 text-center mt-2 leading-relaxed">
              You will no longer receive new messages from this group. You
              can still view your previous messages in Former Groups.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLeaveConfirmation(false)}
                disabled={isLeavingGroup}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm font-medium transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleLeaveGroup}
                disabled={isLeavingGroup}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {isLeavingGroup ? "Leaving..." : "Leave Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMembers && !isFormerMember && (
        <div
          className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddMembers(false)}
        >
          <div
            className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-slate-100 font-semibold">
                  Add Members
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  Select people to add to {selectedGroup.name}
                </p>
              </div>

              <button
                onClick={() => setShowAddMembers(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-700">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3">
                <Search className="w-4 h-4 text-slate-400" />

                <input
                  type="text"
                  value={contactSearch}
                  onChange={(event) =>
                    setContactSearch(event.target.value)
                  }
                  placeholder="Search by name or email..."
                  className="w-full bg-transparent py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="max-h-[350px] min-h-[120px] overflow-y-auto p-3 space-y-2">
              {availableContacts.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">
                  {contacts.length === 0
                    ? "No contacts available."
                    : "No available users found."}
                </p>
              ) : (
                availableContacts.map((contact) => {
                  const contactId = getUserId(contact);
                  const isSelected =
                    selectedNewMemberIds.includes(contactId);

                  return (
                    <button
                      key={contactId}
                      onClick={() => toggleNewMember(contactId)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        isSelected
                          ? "bg-cyan-500/10 border-cyan-500/50"
                          : "bg-slate-700/40 border-transparent hover:bg-slate-700"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-600 shrink-0">
                        <img
                          src={contact.profilePic || "/avatar.png"}
                          alt={contact.fullName || "User"}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm text-slate-100 font-medium truncate">
                          {contact.fullName || "User"}
                        </p>

                        <p className="text-xs text-slate-400 truncate">
                          {contact.email}
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="checkbox checkbox-info checkbox-sm"
                      />
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-700">
              <p className="text-xs text-slate-400">
                {selectedNewMemberIds.length} selected
              </p>

              <button
                onClick={handleAddMembers}
                disabled={
                  selectedNewMemberIds.length === 0 || isAddingMembers
                }
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {isAddingMembers ? "Adding..." : "Add to Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupChatContainer;
