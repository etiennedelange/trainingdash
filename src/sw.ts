/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// API responses are never precached — the dashboard must not show a stale
// history that looks current. The shell is offline; the data is not.
// These must match the Worker's own routes exactly. /webhook is a prefix
// because the live route is /webhook/:token.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/auth\//, /^\/webhook/, /^\/live$/],
  }),
);

// UpdatePrompt (registerType: "prompt") asks the waiting worker to take over.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

self.addEventListener("push", (event) => {
  const data = (event.data?.json() ?? {}) as Partial<PushPayload>;
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Trainingdash", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string })?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows[0];
      if (existing) {
        await existing.focus();
        await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
