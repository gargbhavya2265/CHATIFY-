import { useState, useRef, useEffect } from "react";
import {
  LogOutIcon,
  VolumeOffIcon,
  Volume2Icon,
  BellIcon,
  BellOffIcon,
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

  const [selectedImg, setSelectedImg] = useState(null);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  return (
    <div className="p-6 border-b border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar online">
            <button
              className="size-14 rounded-full overflow-hidden relative group"
              onClick={() => fileInputRef.current.click()}
            >
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="User image"
                className="size-full object-cover"
              />

              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-xs">Change</span>
              </div>
            </button>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div>
            <h3 className="text-slate-200 font-medium text-base max-w-[180px] truncate">
              {authUser.fullName}
            </h3>

            <p className="text-slate-400 text-xs">Online</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <button
            title={isPushEnabled ? "Disable notifications" : "Enable notifications"}
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
  );
}

export default ProfileHeader;