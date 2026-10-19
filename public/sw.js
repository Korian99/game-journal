function appPath(value) {
  try {
    const target = new URL(
      typeof value === "string" ? value : "/",
      self.location.origin,
    );
    return target.origin === self.location.origin
      ? target.pathname + target.search + target.hash
      : "/";
  } catch {
    return "/";
  }
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) => {
  let data = {
    title: "Game Journal",
    body: "Hay novedades en tu lista.",
    url: "/",
  };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "game-journal",
      data: { url: appPath(data.url) },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    appPath(event.notification.data?.url),
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
