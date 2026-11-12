import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  SmilePlus,
  CornerUpLeft,
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

  const [activeReactionPicker, setActiveReactionPicker] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedText, setEditedText] = useState("");

  useEffect(() => {
    if (!selectedUser?._id) return;

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
    if (isMessagesLoading || !messageEndRef.current) return;

    const frameId = requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [messages, isMessagesLoading]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
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
  }, []);

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
    if (!editedText.trim()) return;

    if (editedText.trim().length > 2000) return;

    await editMessage(messageId, editedText.trim());

    setEditingMessageId(null);
    setEditedText("");
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

    return originalSenderId === authUser._id.toString()
      ? "You"
      : selectedUser.fullName || selectedUser.username || "Contact";
  };

  const renderReplyPreview = (replyTo) => {
    if (!replyTo) return null;

    return (
      <button
        type="button"
        onClick={() => handleScrollToMessage(replyTo._id)}
        className="w-full text-left mb-2 rounded-md border-l-4 border-cyan-400 bg-black/20 px-3 py-2 hover:bg-black/30 transition-colors"
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
          </>
        )}
      </button>
    );
  };

  return (
    <>
      <ChatHeader />

      <div className="flex-1 px-6 overflow-y-auto py-8">
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isOwnMessage =
                msg.senderId?.toString() === authUser._id?.toString();

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
                  reaction.userId?.toString() === authUser._id?.toString()
              );

              return (
                <div
                  key={msg._id}
                  id={`message-${msg._id}`}
                  className={`chat ${
                    isOwnMessage ? "chat-end" : "chat-start"
                  }`}
                >
                  <div className="relative max-w-[85%]">
                    <div
                      className={`chat-bubble relative transition-all duration-300 ${
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
                            onChange={(e) => setEditedText(e.target.value)}
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

                    {!isDeleted && !isEditing && (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handleReply(msg)}
                          className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
                          title="Reply"
                          disabled={
                            !msg._id || msg._id.startsWith("temp-")
                          }
                        >
                          <CornerUpLeft size={17} />
                        </button>

                        {isOwnMessage ? (
                          <>
                            {msg.text && (
                              <button
                                type="button"
                                onClick={() => handleEditClick(msg)}
                                className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
                                title="Edit message"
                              >
                                <Pencil size={16} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDelete(msg._id)}
                              className="text-slate-400 hover:text-red-400 transition-colors p-1"
                              title="Delete message"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <div className="relative" ref={reactionPickerRef}>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReactionPicker(
                                  activeReactionPicker === msg._id
                                    ? null
                                    : msg._id
                                )
                              }
                              className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
                              title="Add reaction"
                            >
                              <SmilePlus size={17} />
                            </button>

                            {activeReactionPicker === msg._id && (
                              <div className="absolute z-50 bottom-full left-0 mb-2 shadow-2xl">
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
                          </div>
                        )}

                        {Object.entries(groupedReactions).map(
                          ([emoji, count]) =>
                            isOwnMessage ? (
                              <span
                                key={emoji}
                                className="flex items-center gap-1 rounded-full px-2 py-1 text-sm border bg-slate-800 border-slate-700 text-slate-300"
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </span>
                            ) : (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReaction(msg._id, emoji)}
                                className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm border transition-colors ${
                                  myReaction?.emoji === emoji
                                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                                }`}
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
              );
            })}

            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser.fullName} />
        )}
      </div>

      <MessageInput />
    </>
  );
}

export default ChatContainer;