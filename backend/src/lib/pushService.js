import User from "../models/User.js";
import webpush from "./webPush.js";

export const sendPushNotification = async (userId, payload) => {
  try {
    const user = await User.findById(userId).select("pushSubscriptions");

    if (!user || !user.pushSubscriptions?.length) {
      return;
    }

    const subscriptions = user.pushSubscriptions;

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            subscription.toObject(),
            JSON.stringify(payload)
          );
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await User.updateOne(
              { _id: userId },
              {
                $pull: {
                  pushSubscriptions: {
                    endpoint: subscription.endpoint,
                  },
                },
              }
            );
          } else {
            console.error(
              "Push notification delivery failed:",
              error.message
            );
          }
        }
      })
    );

    return results;
  } catch (error) {
    console.error("Push notification service error:", error.message);
  }
};