
import { Fragment, useEffect, useRef, useState } from "react";

import {
  Check,
  CheckCheck,
  Smile,
  Reply,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";

import EmojiPicker from "emoji-picker-react";

import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    toggleReaction,
    setReplyingTo,
    editMessage,
    deleteMessage,
  } = useChatStore();

  const { authUser } = useAuthStore();

  const messageEndRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const hasScrolledToInitialPosition = useRef(false);

  const [activeReactionPicker, setActiveReactionPicker] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedText, setEditedText] = useState("");

  useEffect(() => {
    if (!selectedUser?._id) return;

    hasScrolledToInitialPosition.current = false;

    getMessagesByUserId(selectedUser._id);
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [
    selectedUser,
    getMessagesByUserId,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  useEffect(() => {
    if (isMessagesLoading || hasScrolledToInitialPosition.current) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const firstUnreadMessage = messages.find(
        (message) => message.wasUnreadBeforeOpening
      );

      const target = firstUnreadMessage
        ? document.getElementById(`message-${firstUnreadMessage._id}`)
        : messageEndRef.current;

      (target || messageEndRef.current)?.scrollIntoView({
        behavior: "auto",
        block: firstUnreadMessage ? "center" : "end",
      });

      hasScrolledToInitialPosition.current = true;
    });

    return () => cancelAnimationFrame(frameId);
  }, [messages, isMessagesLoading]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        activeReactionPicker &&
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(event.target)
      ) {
        setActiveReactionPicker(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeReactionPicker]);

  const getDateKey = (date) => {
    const messageDate = new Date(date);

    if (Number.isNaN(messageDate.getTime())) return "";

    const year = messageDate.getFullYear();
    const month = String(messageDate.getMonth() + 1).padStart(2, "0");
    const day = String(messageDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getDateLabel = (date) => {
    const messageDate = new Date(date);

    const today = new Date();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (getDateKey(messageDate) === getDateKey(today)) {
      return "Today";
    }

    if (getDateKey(messageDate) === getDateKey(yesterday)) {
      return "Yesterday";
    }

    return messageDate.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const unreadMessages = messages.filter(
    (message) => message.wasUnreadBeforeOpening
  );

  const firstUnreadMessageId = unreadMessages[0]?._id?.toString();
  const unreadCount = unreadMessages.length;

  const renderMessageStatus = (status) => {
    if (status === "read") {
      return <CheckCheck size={16} className="text-sky-300" />;
    }

    if (status === "delivered") {
      return <CheckCheck size={16} className="text-slate-300" />;
    }

    return <Check size={16} className="text-slate-300" />;
  };

  const handleReaction = (messageId, emoji) => {
    toggleReaction(messageId, emoji);
    setActiveReactionPicker(null);
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    setActiveReactionPicker(null);
  };

  const handleEditClick = (message) => {
    setEditingMessageId(message._id);
    setEditedText(message.text || "");
    setActiveReactionPicker(null);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditedText("");
  };

  const handleEditSave = async (messageId) => {
    const trimmedText = editedText.trim();

    if (!trimmedText || trimmedText.length > 2000) return;

    await editMessage(messageId, trimmedText);

    handleEditCancel();
  };

  const handleDelete = async (messageId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this message?"
    );

    if (!confirmed) return;

    await deleteMessage(messageId);

    if (editingMessageId === messageId) {
      handleEditCancel();
    }

    setActiveReactionPicker(null);
  };

  const handleScrollToMessage = (messageId) => {
    const originalMessage = document.getElementById(
      `message-${messageId}`
    );

    if (!originalMessage) return;

    originalMessage.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    originalMessage.classList.add("ring-2", "ring-cyan-400");

    setTimeout(() => {
      originalMessage.classList.remove("ring-2", "ring-cyan-400");
    }, 1500);
  };

  const getReplySenderName = (replyTo) => {
    const originalSenderId =
      replyTo.senderId?._id?.toString() ||
      replyTo.senderId?.toString();

    return originalSenderId === authUser?._id?.toString()
      ? "You"
      : selectedUser?.fullName || selectedUser?.username || "Contact";
  };

  const renderReplyPreview = (replyTo) => {
    if (!replyTo) return null;

    return (
      <button
        type="button"
        onClick={() => handleScrollToMessage(replyTo._id)}
        className="w-full text-left mb-2 rounded-lg border-l-[3px] border-cyan-400 bg-black/20 px-3 py-2 hover:bg-black/30 transition-colors"
      >
        <p className="text-xs font-semibold text-cyan-300 mb-1">
          {getReplySenderName(replyTo)}
        </p>

        {replyTo.isDeleted ? (
          <p className="text-sm italic opacity-70">
            This message was deleted
          </p>
        ) : (
          <>
            {replyTo.text && (
              <p className="text-sm opacity-90 line-clamp-2">
                {replyTo.text}
              </p>
            )}

            {replyTo.image && (
              <div className="flex items-center gap-2 mt-1">
                <img
                  src={replyTo.image}
                  alt="Replied image"
                  className="w-10 h-10 object-cover rounded"
                />
                <span className="text-xs opacity-80">Photo</span>
              </div>
            )}

            {replyTo.audio && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm">🎤</span>
                <span className="text-xs opacity-80">Voice message</span>
              </div>
            )}
          </>
        )}
      </button>
    );
  };

  const renderToolbarButton = (
    Icon,
    label,
    onClick,
    color = "text-slate-300"
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-8 h-8 flex items-center justify-center rounded-lg ${color} hover:bg-white/10 transition-all duration-150`}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );

  return (
    <>
      <ChatHeader />

      <div className="flex-1 px-6 overflow-y-auto py-8">
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const previousMessage = messages[index - 1];

              const showDateSeparator =
                index === 0 ||
                getDateKey(previousMessage.createdAt) !==
                  getDateKey(msg.createdAt);

              const dateSeparator = showDateSeparator ? (
                <div className="flex justify-center my-5">
                  <span className="text-xs font-medium text-slate-300 bg-slate-800/90 border border-slate-700 rounded-full px-4 py-1.5 shadow-sm">
                    {getDateLabel(msg.createdAt)}
                  </span>
                </div>
              ) : null;

              const unreadDivider =
                msg._id?.toString() === firstUnreadMessageId ? (
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-cyan-500/50" />
                    <span className="text-xs font-semibold text-cyan-300 whitespace-nowrap">
                      {unreadCount} unread{" "}
                      {unreadCount === 1 ? "message" : "messages"}
                    </span>
                    <div className="flex-1 h-px bg-cyan-500/50" />
                  </div>
                ) : null;

              const isOwnMessage =
                msg.senderId?.toString() === authUser?._id?.toString();

              const isDeleted = msg.isDeleted === true;
              const isEditing = editingMessageId === msg._id;

              const reactions = msg.reactions || [];

              const groupedReactions = reactions.reduce(
                (groups, reaction) => {
                  groups[reaction.emoji] =
                    (groups[reaction.emoji] || 0) + 1;

                  return groups;
                },
                {}
              );

              const myReaction = reactions.find(
                (reaction) =>
                  reaction.userId?.toString() === authUser?._id?.toString()
              );

              const showToolbar = !isDeleted && !isEditing;

              return (
                <Fragment key={msg._id}>
                  {dateSeparator}
                  {unreadDivider}

                  <div
                    id={`message-${msg._id}`}
                    className={`chat ${
                      isOwnMessage ? "chat-end" : "chat-start"
                    }`}
                  >
                    <div className="relative w-fit max-w-[85%] group/message">
                      {/* Floating Message Toolbar */}
                      {showToolbar && (
                        <div
                          className={`absolute z-40 top-full mt-2 ${
                            isOwnMessage ? "right-0" : "left-0"
                          } flex items-center gap-1 p-1.5 rounded-xl border border-slate-600/70 bg-slate-900/95 backdrop-blur-xl shadow-xl opacity-100 md:opacity-0 md:translate-y-1 md:group-hover/message:opacity-100 md:group-hover/message:translate-y-0 md:group-focus-within/message:opacity-100 md:group-focus-within/message:translate-y-0 transition-all duration-200`}
                        >
                          {renderToolbarButton(
                            Smile,
                            "React",
                            () =>
                              setActiveReactionPicker(
                                activeReactionPicker === msg._id
                                  ? null
                                  : msg._id
                              ),
                            activeReactionPicker === msg._id
                              ? "text-cyan-300 bg-cyan-500/20"
                              : "text-slate-300"
                          )}

                          {!isOwnMessage &&
                            renderToolbarButton(
                              Reply,
                              "Reply",
                              () => handleReply(msg)
                            )}

                          {isOwnMessage &&
                            msg.text &&
                            renderToolbarButton(
                              Pencil,
                              "Edit",
                              () => handleEditClick(msg)
                            )}

                          {isOwnMessage &&
                            renderToolbarButton(
                              Trash2,
                              "Delete",
                              () => handleDelete(msg._id),
                              "text-red-400 hover:text-red-300"
                            )}
                        </div>
                      )}

                      {/* Reaction Picker */}
                      {activeReactionPicker === msg._id && (
                        <div
                          ref={reactionPickerRef}
                          className={`absolute z-50 bottom-full mb-2 ${
                            isOwnMessage ? "right-0" : "left-0"
                          }`}
                        >
                          <EmojiPicker
                            onEmojiClick={(emojiData) =>
                              handleReaction(msg._id, emojiData.emoji)
                            }
                            theme="dark"
                            width={300}
                            height={350}
                            previewConfig={{ showPreview: false }}
                          />
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`chat-bubble relative w-fit max-w-full transition-all duration-300 ${
                          isDeleted
                            ? "bg-slate-700/70 text-slate-300"
                            : isOwnMessage
                              ? "bg-cyan-600 text-white"
                              : "bg-slate-800 text-slate-200"
                        }`}
                      >
                        {msg.replyTo && renderReplyPreview(msg.replyTo)}

                        {isEditing ? (
                          <div className="min-w-[220px]">
                            <textarea
                              value={editedText}
                              onChange={(event) =>
                                setEditedText(event.target.value)
                              }
                              maxLength={2000}
                              rows={3}
                              autoFocus
                              className="w-full resize-none rounded-lg bg-slate-900 text-white border border-cyan-400 p-3 outline-none"
                            />

                            <div className="flex justify-between items-center mt-2">
                              <span className="text-xs opacity-70">
                                {editedText.length}/2000
                              </span>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleEditCancel}
                                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEditSave(msg._id)}
                                  disabled={
                                    !editedText.trim() ||
                                    editedText.length > 2000
                                  }
                                  className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50"
                                  title="Save changes"
                                >
                                  <Save size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : isDeleted ? (
                          <p className="italic text-sm opacity-80">
                            This message was deleted
                          </p>
                        ) : (
                          <>
                            {msg.image && (
                              <img
                                src={msg.image}
                                alt="Shared"
                                className="rounded-lg h-48 object-cover"
                              />
                            )}

                            {msg.audio?.url && (
                              <div className="my-2 min-w-[220px] max-w-full">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm">🎤</span>
                                  <span className="text-xs font-medium">
                                    Voice message
                                  </span>
                                </div>

                                <audio
                                  controls
                                  preload="metadata"
                                  src={msg.audio.url}
                                  className="w-full max-w-[280px] h-10"
                                >
                                  Your browser does not support audio playback.
                                </audio>
                              </div>
                            )}

                            {msg.text && (
                              <p className="mt-2 whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            )}
                          </>
                        )}

                        <p className="text-xs mt-1 opacity-75 flex items-center justify-end gap-1">
                          {msg.isEdited && !isDeleted && (
                            <span className="italic mr-1">Edited</span>
                          )}

                          {new Date(msg.createdAt).toLocaleTimeString(
                            undefined,
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}

                          {isOwnMessage &&
                            !isDeleted &&
                            renderMessageStatus(msg.status)}
                        </p>
                      </div>

                      {/* Reactions */}
                      {Object.entries(groupedReactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(groupedReactions).map(
                            ([emoji, count]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() =>
                                  handleReaction(msg._id, emoji)
                                }
                                className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm border transition-colors ${
                                  myReaction?.emoji === emoji
                                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                                    : "bg-slate-800 border-slate-700 text-slate-300"
                                } hover:border-cyan-400/70`}
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}

            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser?.fullName} />
        )}
      </div>

      <MessageInput />
    </>
  );
}

export default ChatContainer;
