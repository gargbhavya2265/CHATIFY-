import User from "../models/User.js";
import { ENV } from "../lib/env.js";

export const getVapidPublicKey = (req, res) => {
  if (!ENV.VAPID_PUBLIC_KEY) {
    return res.status(500).json({
      message: "Web Push is not configured.",
    });
  }

  res.status(200).json({
    publicKey: ENV.VAPID_PUBLIC_KEY,
  });
};

export const subscribeToPush = async (req, res) => {
  try {
    const subscription = req.body;

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res.status(400).json({
        message: "Invalid push subscription.",
      });
    }

    await User.updateOne(
      { _id: req.user._id },
      {
        $pull: {
          pushSubscriptions: {
            endpoint: subscription.endpoint,
          },
        },
      }
    );

    await User.updateOne(
      { _id: req.user._id },
      {
        $push: {
          pushSubscriptions: subscription,
        },
      }
    );

    res.status(201).json({
      message: "Push notifications enabled successfully.",
    });
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);

    res.status(500).json({
      message: "Failed to enable push notifications.",
    });
  }
};

export const unsubscribeFromPush = async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        message: "Subscription endpoint is required.",
      });
    }

    await User.updateOne(
      { _id: req.user._id },
      {
        $pull: {
          pushSubscriptions: { endpoint },
        },
      }
    );

    res.status(200).json({
      message: "Push notifications disabled successfully.",
    });
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error);

    res.status(500).json({
      message: "Failed to disable push notifications.",
    });
  }
};
