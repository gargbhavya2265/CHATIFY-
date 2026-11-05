self.addEventListener("push", (event) => {
  if (!event.data) return;

  event.waitUntil(
    (async () => {
      const data = event.data.json();

      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const isAppVisible = clientsList.some(
        (client) => client.visibilityState === "visible"
      );

      // Avoid duplicate notifications when Chatify is already visible.
      if (isAppVisible) return;

      await self.registration.showNotification(
        data.title || "New message",
        {
          body: data.body || "You received a new message.",
          icon: data.icon || "/avatar.png",
          badge: "/avatar.png",
          tag: `chatify-${data.senderId || "message"}`,
          data: {
            url: data.url || "/",
            senderId: data.senderId,
          },
        }
      );
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const targetUrl = new URL(
    notificationData.url || "/",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        if (client.url.startsWith(self.location.origin)) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })()
  );
});