
import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useAuthStore } from "../store/useAuthStore";

function formatMessageTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const today = new Date();

  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}

function getLastMessagePreview(message) {
  if (!message) return "Start a conversation";

  if (message.isDeleted) return "This message was deleted";

  if (message.text) return message.text;

  if (message.image) return "📷 Photo";

  return "Message";
}

function ChatsList() {
  const {
    getMyChatPartners,
    chats,
    isUsersLoading,
    setSelectedUser,
    openUserProfile,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  const handleProfileClick = (event, userId) => {
    event.stopPropagation();
    openUserProfile(userId);
  };

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  if (chats.length === 0) return <NoChatsFound />;

  return (
    <>
      {chats.map((chat) => (
        <div
          key={chat._id}
          className="bg-cyan-500/10 p-3 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
          onClick={() => setSelectedUser(chat)}
        >
          <div className="flex items-center gap-3">
            <div
              className={`avatar ${
                onlineUsers.includes(chat._id) ? "online" : "offline"
              }`}
            >
              <button
                type="button"
                className="size-12 rounded-full overflow-hidden cursor-pointer"
                onClick={(event) =>
                  handleProfileClick(event, chat._id)
                }
                aria-label={`View ${chat.fullName}'s profile`}
              >
                <img
                  src={chat.profilePic || "/avatar.png"}
                  alt={chat.fullName}
                  className="size-full object-cover"
                />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-slate-200 font-medium truncate text-left hover:text-cyan-400 transition-colors"
                  onClick={(event) =>
                    handleProfileClick(event, chat._id)
                  }
                >
                  {chat.fullName}
                </button>

                <span className="text-xs text-slate-400 shrink-0">
                  {formatMessageTime(chat.lastMessageAt)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-sm text-slate-400 truncate">
                  {getLastMessagePreview(chat.lastMessage)}
                </p>

                {chat.unreadCount > 0 && (
                  <span className="bg-cyan-500 text-slate-950 text-xs font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center shrink-0">
                    {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default ChatsList;
