import { axiosInstance } from "./axios";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) => character.charCodeAt(0))
  );
};

export const enablePushNotifications = async () => {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Push notifications are not supported by this browser.");
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error("Notification permission was not granted.");
    }

    const registration = await navigator.serviceWorker.ready;

    const { data } = await axiosInstance.get(
      "/push/vapid-public-key"
    );

    const applicationServerKey = urlBase64ToUint8Array(
      data.publicKey
    );

    let subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    await axiosInstance.post(
      "/push/subscribe",
      subscription.toJSON()
    );

    return {
      success: true,
      message: "Push notifications enabled successfully!",
    };
  } catch (error) {
    console.error("Enable push notifications error:", error);

    return {
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        "Failed to enable notifications.",
    };
  }
};

export const disablePushNotifications = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return {
        success: true,
        message: "No active push subscription found.",
      };
    }

    await axiosInstance.delete("/push/unsubscribe", {
      data: {
        endpoint: subscription.endpoint,
      },
    });

    await subscription.unsubscribe();

    return {
      success: true,
      message: "Push notifications disabled successfully!",
    };
  } catch (error) {
    console.error("Disable push notifications error:", error);

    return {
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        "Failed to disable notifications.",
    };
  }
};
