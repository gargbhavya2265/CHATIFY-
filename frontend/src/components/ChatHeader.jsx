
import { XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";

function ChatHeader() {
  const {
    selectedUser,
    setSelectedUser,
    isTyping,
    openUserProfile,
    viewingProfile,
  } = useChatStore();

  const { onlineUsers, lastSeenUpdates } = useAuthStore();

  const isOnline = onlineUsers.includes(selectedUser._id);

  const lastSeen =
    lastSeenUpdates[selectedUser._id] || selectedUser.lastSeen;

  const getLastSeenText = () => {
    if (!lastSeen) return "Offline";

    const date = new Date(lastSeen);

    if (Number.isNaN(date.getTime())) return "Offline";

    return `Last seen ${date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape" && !viewingProfile) {
        setSelectedUser(null);
      }
    };

    window.addEventListener("keydown", handleEscKey);

    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser, viewingProfile]);

  const handleProfileClick = () => {
    openUserProfile(selectedUser._id);
  };

  return (
    <div
      className="chatify-chat-header flex justify-between items-center bg-slate-800/50 border-b
      border-slate-700/50 max-h-[84px] px-6 flex-1"
    >
      <div className="flex items-center space-x-3">
        <div className={`avatar ${isOnline ? "online" : "offline"}`}>
          <button
            type="button"
            className="w-12 rounded-full overflow-hidden cursor-pointer"
            onClick={handleProfileClick}
            aria-label={`View ${selectedUser.fullName}'s profile`}
          >
            <img
              src={selectedUser.profilePic || "/avatar.png"}
              alt={selectedUser.fullName}
              className="size-full object-cover"
            />
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={handleProfileClick}
            className="text-slate-200 font-medium hover:text-cyan-400 transition-colors"
          >
            {selectedUser.fullName}
          </button>

          <p className="text-sm">
            {isTyping ? (
              <span className="text-cyan-400">Typing...</span>
            ) : (
              <span className={isOnline ? "text-green-400" : "text-slate-400"}>
                {isOnline ? "Online" : getLastSeenText()}
              </span>
            )}
          </p>
        </div>
      </div>

      <button onClick={() => setSelectedUser(null)}>
        <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
      </button>
    </div>
  );
}

export default ChatHeader;
