
import { useEffect, useRef } from "react";
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
        getMyFormerGroups,
        getAllContacts,
    } = useChatStore();

    const { socket } = useAuthStore();

    const hasFetchedInitialData = useRef(false);

    // Fetch initial data only once.
    useEffect(() => {
        if (hasFetchedInitialData.current) return;

        hasFetchedInitialData.current = true;

        getMyChatPartners();
        getMyGroups();
        getMyFormerGroups();
        getAllContacts();
    }, [
        getMyChatPartners,
        getMyGroups,
        getMyFormerGroups,
        getAllContacts,
    ]);

    // Handle socket events.
    useEffect(() => {
        if (!socket) return;

        let hasConnectedOnce = socket.connected;

        const refreshChats = () => {
            getMyChatPartners();
            getMyGroups();
        };

        const handleConnect = () => {
            if (!hasConnectedOnce) {
                hasConnectedOnce = true;
                return;
            }

            refreshChats();
        };

        socket.on("newMessage", refreshChats);
        socket.on("newGroupMessage", refreshChats);
        socket.on("connect", handleConnect);

        return () => {
            socket.off("newMessage", refreshChats);
            socket.off("newGroupMessage", refreshChats);
            socket.off("connect", handleConnect);
        };
    }, [socket, getMyChatPartners, getMyGroups]);

    return (
        <div className="relative w-full max-w-6xl h-[800px] min-h-0">
            <BorderAnimatedContainer>
                {/* LEFT SIDE */}
                <div className="w-80 shrink-0 min-h-0 bg-slate-800/50 backdrop-blur-sm flex flex-col">
                    <ProfileHeader />
                    <ActiveTabSwitch />

                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                        {activeTab === "chats" && <ChatsList />}
                        {activeTab === "contacts" && <ContactList />}
                        {activeTab === "groups" && <GroupsList />}
                    </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-slate-900/50 backdrop-blur-sm">
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
