import { Navigate, Route, Routes } from "react-router";
import { useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";

import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import PageLoader from "./components/PageLoader";
import UserProfileModal from "./components/UserProfileModal";

import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useThemeStore } from "./store/useThemeStore";

function App() {
    const { checkAuth, isCheckingAuth, authUser, socket } = useAuthStore();
    const theme = useThemeStore((state) => state.theme);

    const {
        viewingProfile,
        subscribeToGroupCreated,
        unsubscribeFromGroupCreated,
        subscribeToProfileUpdates,
        unsubscribeFromProfileUpdates,
        getMyGroups,
        getMyFormerGroups,
        setSelectedGroup,
    } = useChatStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Global group creation listener.
    useEffect(() => {
        if (!authUser || !socket) return;

        subscribeToGroupCreated();

        return () => {
            unsubscribeFromGroupCreated();
        };
    }, [
        authUser,
        socket,
        subscribeToGroupCreated,
        unsubscribeFromGroupCreated,
    ]);

    // Global profile update listener.
    useEffect(() => {
        if (!authUser || !socket) return;

        subscribeToProfileUpdates();

        return () => {
            unsubscribeFromProfileUpdates();
        };
    }, [
        authUser,
        socket,
        subscribeToProfileUpdates,
        unsubscribeFromProfileUpdates,
    ]);

    // Global group details update listener.
    useEffect(() => {
        if (!authUser || !socket) return;

        const handleGroupUpdated = ({ group: updatedGroup } = {}) => {
            console.log("GROUP UPDATED EVENT RECEIVED:", {
                currentUser: authUser.fullName,
                socketId: socket.id,
                socketConnected: socket.connected,
                groupId: updatedGroup?._id,
                groupName: updatedGroup?.name,
                groupDescription: updatedGroup?.description,
            });

            if (!updatedGroup?._id) {
                console.warn("GROUP UPDATED EVENT: Invalid group payload");
                return;
            }

            useChatStore.setState((state) => {
                const groupExists = state.groups.some(
                    (group) =>
                        group._id?.toString() === updatedGroup._id.toString()
                );

                const selectedGroupMatches =
                    state.selectedGroup?._id?.toString() ===
                    updatedGroup._id.toString();

                console.log("GROUP UPDATED STATE CHECK:", {
                    currentUser: authUser.fullName,
                    groupExists,
                    selectedGroupMatches,
                });

                return {
                    groups: state.groups.map((group) =>
                        group._id?.toString() === updatedGroup._id.toString()
                            ? updatedGroup
                            : group
                    ),
                    selectedGroup: selectedGroupMatches
                        ? updatedGroup
                        : state.selectedGroup,
                };
            });
        };

        socket.on("groupUpdated", handleGroupUpdated);

        return () => {
            socket.off("groupUpdated", handleGroupUpdated);
        };
    }, [authUser, socket]);

    // Global group member added notification listener.
    useEffect(() => {
        if (!authUser || !socket) return;

        const handleGroupMemberAdded = async ({
            group,
            addedBy,
            message,
        } = {}) => {
            if (!group?._id) return;

            // Refresh active and archived groups.
            await Promise.all([
                getMyGroups(),
                getMyFormerGroups(),
            ]);

            // Show notification to the newly added user.
            toast.success(
                message ||
                    `${addedBy?.fullName || "Someone"} added you to ${group.name}.`,
                {
                    duration: 5000,
                }
            );
        };

        socket.on("groupMemberAdded", handleGroupMemberAdded);

        return () => {
            socket.off("groupMemberAdded", handleGroupMemberAdded);
        };
    }, [
        authUser,
        socket,
        getMyGroups,
        getMyFormerGroups,
    ]);

    // Global group removal / leave / deletion listener.
    useEffect(() => {
        if (!authUser || !socket) return;

        const handleGroupRemoved = async ({
            groupId,
            message,
            reason,
        } = {}) => {
            if (!groupId) return;

            const chatStore = useChatStore.getState();

            const selectedGroupId =
                chatStore.selectedGroup?._id?.toString();

            // Close the currently open group if it was removed.
            if (selectedGroupId === groupId.toString()) {
                setSelectedGroup(null);
            }

            // Refresh active and archived groups.
            await Promise.all([
                getMyGroups(),
                getMyFormerGroups(),
            ]);

            if (message) {
                if (reason === "deleted") {
                    console.log("Group deleted:", message);
                } else {
                    console.log("Group membership ended:", message);
                }
            }
        };

        socket.on("groupRemoved", handleGroupRemoved);

        return () => {
            socket.off("groupRemoved", handleGroupRemoved);
        };
    }, [
        authUser,
        socket,
        getMyGroups,
        getMyFormerGroups,
        setSelectedGroup,
    ]);

    if (isCheckingAuth) return <PageLoader />;

    return (
        <div
            data-theme={theme}
            className="min-h-screen bg-slate-900 relative flex items-center justify-center p-4 overflow-hidden"
        >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]" />

            <div className="absolute top-0 -left-4 size-96 bg-pink-500 opacity-20 blur-[100px]" />

            <div className="absolute bottom-0 -right-4 size-96 bg-cyan-500 opacity-20 blur-[100px]" />

            <Routes>
                <Route
                    path="/"
                    element={
                        authUser ? (
                            <ChatPage />
                        ) : (
                            <Navigate to="/login" />
                        )
                    }
                />

                <Route
                    path="/login"
                    element={
                        !authUser ? (
                            <LoginPage />
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />

                <Route
                    path="/signup"
                    element={
                        !authUser ? (
                            <SignUpPage />
                        ) : (
                            <Navigate to="/" />
                        )
                    }
                />
            </Routes>

            <UserProfileModal
                key={viewingProfile?._id?.toString() || "closed"}
            />

            <Toaster />
        </div>
    );
}

export default App;
