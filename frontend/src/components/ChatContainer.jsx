
import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, SmilePlus } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";

const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    toggleReaction,
  } = useChatStore();

  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [activeReactionPicker, setActiveReactionPicker] = useState(null);

  useEffect(() => {
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
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  return (
    <>
      <ChatHeader />

      <div className="flex-1 px-6 overflow-y-auto py-8">
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isOwnMessage = msg.senderId === authUser._id;
              const reactions = msg.reactions || [];

              const groupedReactions = reactions.reduce((groups, reaction) => {
                groups[reaction.emoji] = (groups[reaction.emoji] || 0) + 1;
                return groups;
              }, {});

              const myReaction = reactions.find(
                (reaction) =>
                  reaction.userId?.toString() === authUser._id?.toString()
              );

              return (
                <div
                  key={msg._id}
                  className={`chat ${isOwnMessage ? "chat-end" : "chat-start"}`}
                >
                  <div className="relative max-w-[85%]">
                    <div
                      className={`chat-bubble relative ${
                        isOwnMessage
                          ? "bg-cyan-600 text-white"
                          : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      {msg.image && (
                        <img
                          src={msg.image}
                          alt="Shared"
                          className="rounded-lg h-48 object-cover"
                        />
                      )}

                      {msg.text && <p className="mt-2">{msg.text}</p>}

                      <p className="text-xs mt-1 opacity-75 flex items-center justify-end gap-1">
                        {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}

                        {isOwnMessage && renderMessageStatus(msg.status)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReactionPicker(
                            activeReactionPicker === msg._id ? null : msg._id
                          )
                        }
                        className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
                        title="Add reaction"
                      >
                        <SmilePlus size={17} />
                      </button>

                      {activeReactionPicker === msg._id && (
                        <div className="absolute z-20 bottom-full mb-2 flex gap-2 rounded-full bg-slate-900 border border-slate-700 shadow-xl p-2">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReaction(msg._id, emoji)}
                              className="text-xl hover:scale-125 transition-transform"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {Object.entries(groupedReactions).map(([emoji, count]) => (
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
                      ))}
                    </div>
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
