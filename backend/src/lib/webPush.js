import webpush from "web-push";
import { ENV } from "./env.js";

if (
  ENV.VAPID_PUBLIC_KEY &&
  ENV.VAPID_PRIVATE_KEY &&
  ENV.VAPID_SUBJECT
) {
  webpush.setVapidDetails(
    ENV.VAPID_SUBJECT,
    ENV.VAPID_PUBLIC_KEY,
    ENV.VAPID_PRIVATE_KEY
  );

  console.log("Web Push configured successfully.");
} else {
  console.warn("Web Push configuration is missing.");
}

export default webpush;
