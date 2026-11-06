
import { useState, useRef, useEffect } from "react";
import {
  LogOutIcon,
  VolumeOffIcon,
  Volume2Icon,
  BellIcon,
  BellOffIcon,
  PencilIcon,
  XIcon,
  CameraIcon,
  Trash2Icon,
  SaveIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

import {
  enablePushNotifications,
  disablePushNotifications,
} from "../lib/pushNotifications";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

function ProfileHeader() {
  const { logout, authUser, updateProfile } = useAuthStore();
  const { isSoundEnabled, toggleSound } = useChatStore();

  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [about, setAbout] = useState("");
  const [selectedImg, setSelectedImg] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const checkPushSubscription = async () => {
      try {
        if (!("serviceWorker" in navigator)) return;

        const registration = await navigator.serviceWorker.ready;
        const subscription =
          await registration.pushManager.getSubscription();

        setIsPushEnabled(!!subscription);
      } catch (error) {
        console.error("Error checking push subscription:", error);
      }
    };

    checkPushSubscription();
  }, []);

  const openEditModal = () => {
    setFullName(authUser?.fullName || "");
    setAbout(authUser?.about || "");
    setSelectedImg(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isSaving) return;

    setIsEditModalOpen(false);
    setSelectedImg(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setSelectedImg(reader.result);
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read image");
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemovePhoto = () => {
    setSelectedImg("");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    const trimmedName = fullName.trim();
    const trimmedAbout = about.trim();

    if (!trimmedName) {
      toast.error("Full name cannot be empty");
      return;
    }

    if (trimmedAbout.length > 150) {
      toast.error("About cannot exceed 150 characters");
      return;
    }

    const updateData = {
      fullName: trimmedName,
      about: trimmedAbout,
    };

    if (selectedImg !== null) {
      updateData.profilePic = selectedImg;
    }

    setIsSaving(true);

    try {
      const success = await updateProfile(updateData);

      if (success) {
        setIsEditModalOpen(false);
        setSelectedImg(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePushToggle = async () => {
    if (isPushLoading) return;

    setIsPushLoading(true);

    try {
      if (isPushEnabled) {
        const result = await disablePushNotifications();

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        setIsPushEnabled(false);
        toast.success(result.message);
      } else {
        const result = await enablePushNotifications();

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        setIsPushEnabled(true);
        toast.success(result.message);
      }
    } finally {
      setIsPushLoading(false);
    }
  };

  const profileImage =
    selectedImg !== null
      ? selectedImg || "/avatar.png"
      : authUser?.profilePic || "/avatar.png";

  return (
    <>
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="avatar online shrink-0">
              <button
                type="button"
                className="size-14 rounded-full overflow-hidden relative group"
                onClick={openEditModal}
                title="Edit profile"
              >
                <img
                  src={authUser?.profilePic || "/avatar.png"}
                  alt="User image"
                  className="size-full object-cover"
                />

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <CameraIcon className="size-5 text-white" />
                </div>
              </button>
            </div>

            <div className="min-w-0">
              <h3 className="text-slate-200 font-medium text-base max-w-[180px] truncate">
                {authUser?.fullName}
              </h3>

              <p className="text-slate-400 text-xs">Online</p>
            </div>

            <button
              type="button"
              onClick={openEditModal}
              className="text-slate-400 hover:text-cyan-400 transition-colors"
              title="Edit profile"
            >
              <PencilIcon className="size-4" />
            </button>
          </div>

          <div className="flex gap-4 items-center shrink-0">
            <button
              title={
                isPushEnabled
                  ? "Disable notifications"
                  : "Enable notifications"
              }
              disabled={isPushLoading}
              className="text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
              onClick={handlePushToggle}
            >
              {isPushEnabled ? (
                <BellIcon className="size-5" />
              ) : (
                <BellOffIcon className="size-5" />
              )}
            </button>

            <button
              className="text-slate-400 hover:text-slate-200 transition-colors"
              onClick={logout}
              title="Logout"
            >
              <LogOutIcon className="size-5" />
            </button>

            <button
              className="text-slate-400 hover:text-slate-200 transition-colors"
              onClick={() => {
                mouseClickSound.currentTime = 0;
                mouseClickSound.play().catch((error) =>
                  console.log("Audio play failed:", error)
                );
                toggleSound();
              }}
              title="Toggle sound"
            >
              {isSoundEnabled ? (
                <Volume2Icon className="size-5" />
              ) : (
                <VolumeOffIcon className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Edit Profile
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Update your personal information
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSaving}
                className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="size-24 rounded-full overflow-hidden border-2 border-slate-600">
                  <img
                    src={profileImage}
                    alt="Profile preview"
                    className="size-full object-cover"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <CameraIcon className="size-4" />
                    Change photo
                  </button>

                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isSaving || (!authUser?.profilePic && selectedImg === null)}
                    className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                  >
                    <Trash2Icon className="size-4" />
                    Remove
                  </button>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <p className="text-xs text-slate-500">
                  JPG, PNG or other image formats · Max 5MB
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Full Name
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  disabled={isSaving}
                  placeholder="Enter your full name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">
                    About
                  </label>

                  <span className="text-xs text-slate-500">
                    {about.length}/150
                  </span>
                </div>

                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  maxLength={150}
                  rows={3}
                  disabled={isSaving}
                  placeholder="Tell people something about yourself..."
                  className="w-full resize-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <SaveIcon className="size-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default ProfileHeader;
