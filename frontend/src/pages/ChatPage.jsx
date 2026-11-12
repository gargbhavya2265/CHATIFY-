
import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import GroupsList from "../components/GroupsList";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";

function ChatPage() {
  const {
    activeTab,
    selectedUser,
    selectedGroup,
    getMyChatPartners,
    getMyGroups,
  } = useChatStore();

  const { socket } = useAuthStore();

  useEffect(() => {
    if (!socket) return;

    const refreshChats = () => {
      getMyChatPartners();
      getMyGroups();
    };

    socket.on("newMessage", refreshChats);
    socket.on("newGroupMessage", refreshChats);
    socket.on("connect", refreshChats);

    refreshChats();

    return () => {
      socket.off("newMessage", refreshChats);
      socket.off("newGroupMessage", refreshChats);
      socket.off("connect", refreshChats);
    };
  }, [socket, getMyChatPartners, getMyGroups]);

  return (
    <div className="chatify-page chatify-workspace relative z-10 h-[min(860px,calc(100dvh-2.5rem))] min-h-[620px] w-full max-w-[1480px]">
      <BorderAnimatedContainer>
        {/* LEFT SIDE */}
        <div className="chatify-sidebar w-[292px] shrink-0 min-h-0 border-r border-white/[0.07] bg-slate-950/45 backdrop-blur-xl flex flex-col max-md:w-[260px]">
          <ProfileHeader />

          <ActiveTabSwitch />

          <div className="chatify-sidebar-content flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {activeTab === "chats" && <ChatsList />}

            {activeTab === "contacts" && <ContactList />}

            {activeTab === "groups" && <GroupsList />}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="chatify-main flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-slate-900/35 backdrop-blur-xl">
          {selectedUser ? (
            <ChatContainer />
          ) : selectedGroup ? (
            <GroupChatContainer />
          ) : (
            <NoConversationPlaceholder />
          )}
        </div>
      </BorderAnimatedContainer>
    </div>
  );
}

export default ChatPage;
