
import { useEffect, useState } from "react";
import {
    X,
    CalendarDays,
    Clock,
    UserRound,
    Pencil,
    Check,
    Mail,
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

const formatDate = (date) => {
    if (!date) return "Not available";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};

const formatLastSeen = (date) => {
    if (!date) return "Last seen unavailable";

    const lastSeen = new Date(date);

    if (Number.isNaN(lastSeen.getTime())) {
        return "Last seen unavailable";
    }

    return `Last seen ${lastSeen.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })}`;
};

function UserProfileModal() {
    const {
        viewingProfile,
        isProfileLoading,
        closeUserProfile,
    } = useChatStore();

    const {
        socket,
        updateProfile,
        onlineUsers,
        lastSeenUpdates,
    } = useAuthStore();

    const [isEditing, setIsEditing] = useState(false);
    const [about, setAbout] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isImageOpen, setIsImageOpen] = useState(false);
    const [error, setError] = useState("");

    const profileUserId = viewingProfile?._id?.toString();

    const isOnline = profileUserId
        ? onlineUsers.some((id) => String(id) === profileUserId)
        : false;

    const lastSeen =
        (profileUserId && lastSeenUpdates[profileUserId]) ||
        viewingProfile?.lastSeen;

    useEffect(() => {
        setAbout(viewingProfile?.about || "");
        setIsEditing(false);
        setIsImageOpen(false);
        setError("");
    }, [viewingProfile?._id]);

    // Listen for real-time profile updates
    useEffect(() => {
        if (!socket) return;

        const handleProfileUpdated = (updatedProfile) => {
            if (!updatedProfile?._id) return;

            const currentProfile =
                useChatStore.getState().viewingProfile;

            if (
                !currentProfile ||
                String(currentProfile._id) !== String(updatedProfile._id)
            ) {
                return;
            }

            useChatStore.setState((state) => ({
                viewingProfile: {
                    ...state.viewingProfile,
                    ...updatedProfile,
                },
            }));

            // Do not overwrite an unsaved About draft
            if (!isEditing) {
                setAbout(updatedProfile.about || "");
            }
        };

        socket.on("profileUpdated", handleProfileUpdated);

        return () => {
            socket.off("profileUpdated", handleProfileUpdated);
        };
    }, [socket, isEditing]);

    useEffect(() => {
        if (!viewingProfile && !isProfileLoading) return;

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                if (isImageOpen) {
                    setIsImageOpen(false);
                } else {
                    closeUserProfile();
                }
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [
        viewingProfile,
        isProfileLoading,
        isImageOpen,
        closeUserProfile,
    ]);

    const handleSaveAbout = async () => {
        if (about.length > 150) return;

        try {
            setIsSaving(true);
            setError("");

            const success = await updateProfile({ about });

            if (!success) {
                setError("Unable to update About. Please try again.");
                return;
            }

            const updatedUser = useAuthStore.getState().authUser;

            useChatStore.setState((state) => ({
                viewingProfile: {
                    ...state.viewingProfile,
                    ...updatedUser,
                },
            }));

            setIsEditing(false);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Unable to update About"
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (!viewingProfile && !isProfileLoading) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                onClick={closeUserProfile}
            >
                <div
                    className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
                        <h2 className="text-lg font-semibold text-slate-100">
                            User Profile
                        </h2>

                        <button
                            onClick={closeUserProfile}
                            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                            aria-label="Close profile"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    <div className="max-h-[calc(85vh-65px)] overflow-y-auto">
                        {isProfileLoading ? (
                            <div className="flex flex-col items-center justify-center gap-4 py-20">
                                <span className="loading loading-spinner loading-lg text-cyan-400" />
                                <p className="text-sm text-slate-400">
                                    Loading profile...
                                </p>
                            </div>
                        ) : viewingProfile ? (
                            <>
                                <div className="flex flex-col items-center px-6 py-8">
                                    <button
                                        onClick={() => setIsImageOpen(true)}
                                        className="size-36 overflow-hidden rounded-full border-4 border-cyan-400/30 bg-slate-800 shadow-xl transition-transform hover:scale-105"
                                        aria-label="View profile photo"
                                    >
                                        <img
                                            src={viewingProfile.profilePic || "/avatar.png"}
                                            alt={viewingProfile.fullName}
                                            className="size-full object-cover"
                                        />
                                    </button>

                                    <h3 className="mt-5 break-words text-center text-2xl font-bold text-white">
                                        {viewingProfile.fullName}
                                    </h3>

                                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                                        <UserRound className="size-4" />
                                        Chatify Member
                                    </p>

                                    {viewingProfile.email && (
                                        <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                                            <Mail className="size-4 shrink-0" />
                                            <span className="break-all">
                                                {viewingProfile.email}
                                            </span>
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-3 border-t border-slate-700/70 p-5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                                            About
                                        </h4>

                                        {viewingProfile.isOwnProfile && !isEditing && (
                                            <button
                                                onClick={() => {
                                                    setAbout(viewingProfile.about || "");
                                                    setError("");
                                                    setIsEditing(true);
                                                }}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-cyan-400 transition-colors hover:bg-slate-800"
                                            >
                                                <Pencil className="size-4" />
                                                Edit
                                            </button>
                                        )}
                                    </div>

                                    {isEditing ? (
                                        <div className="space-y-3 rounded-xl bg-slate-800/70 p-4">
                                            <textarea
                                                value={about}
                                                onChange={(event) => setAbout(event.target.value)}
                                                maxLength={150}
                                                rows={3}
                                                placeholder="Write something about yourself..."
                                                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-cyan-400"
                                            />

                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-400">
                                                    {about.length}/150 characters
                                                </span>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setAbout(viewingProfile.about || "");
                                                            setIsEditing(false);
                                                            setError("");
                                                        }}
                                                        disabled={isSaving}
                                                        className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                                                    >
                                                        Cancel
                                                    </button>

                                                    <button
                                                        onClick={handleSaveAbout}
                                                        disabled={isSaving || about.length > 150}
                                                        className="flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <Check className="size-4" />
                                                        {isSaving ? "Saving..." : "Save"}
                                                    </button>
                                                </div>
                                            </div>

                                            {error && (
                                                <p className="text-sm text-red-400">
                                                    {error}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl bg-slate-800/70 p-4">
                                            <p className="break-words text-sm leading-relaxed text-slate-200">
                                                {viewingProfile.about || "Hey there! I am using Chatify."}
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 rounded-xl bg-slate-800/70 p-4">
                                        <div className="rounded-lg bg-cyan-500/10 p-3">
                                            <CalendarDays className="size-5 text-cyan-400" />
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-400">
                                                Joined Chatify
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-slate-200">
                                                {formatDate(viewingProfile.createdAt)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 rounded-xl bg-slate-800/70 p-4">
                                        <div className="rounded-lg bg-cyan-500/10 p-3">
                                            <Clock className="size-5 text-cyan-400" />
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-400">
                                                {isOnline ? "Status" : "Last Seen"}
                                            </p>

                                            {isOnline ? (
                                                <p className="mt-1 flex items-center gap-2 text-sm font-medium text-emerald-400">
                                                    <span className="size-2 rounded-full bg-emerald-400" />
                                                    Online
                                                </p>
                                            ) : (
                                                <p className="mt-1 text-sm font-medium text-slate-200">
                                                    {formatLastSeen(lastSeen)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {isImageOpen && viewingProfile && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4"
                    onClick={() => setIsImageOpen(false)}
                >
                    <button
                        onClick={() => setIsImageOpen(false)}
                        className="absolute right-5 top-5 rounded-full p-3 text-white hover:bg-white/10"
                        aria-label="Close photo"
                    >
                        <X className="size-6" />
                    </button>

                    <img
                        src={viewingProfile.profilePic || "/avatar.png"}
                        alt={viewingProfile.fullName}
                        className="max-h-[85vh] max-w-full rounded-xl object-contain"
                        onClick={(event) => event.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}

export default UserProfileModal;
