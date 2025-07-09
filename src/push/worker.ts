/// <reference lib="webworker" />

declare global {
  interface PushSubscriptionChangeEvent extends ExtendableEvent {
    oldSubscription: PushSubscription | null;
  }
}

declare const self: ServiceWorkerGlobalScope;

import { urlB64ToUint8Array } from "./helpers.ts";
import { publicKey, redirect } from "./config.ts";
import { host } from "./config.ts";

self.addEventListener("push", async (event) => {
  if (event.data) {
    const notification = event.data.json();
    // const options: NotificationOptions = {
    //   body: notification.body,
    //   icon: "/icons/icon-128x128.png",
    //   badge: "/icons/icon-128x128.png",
    //   data: {
    //     url: notification.url ?? redirect,
    //     dateOfArrival: Date.now(),
    //     primaryKey: 1
    //   }
    // };

    event.waitUntil(self.registration.showNotification(notification.title, notification.options));
  }
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? redirect;
  event.waitUntil(self.clients.openWindow(targetUrl));
});

self.addEventListener("pushsubscriptionchange", (event: PushSubscriptionChangeEvent | any) => {
  const key = urlB64ToUint8Array(publicKey);
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .then((newSub: PushSubscription) => {
        return fetch(`${host}/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: redirect, data: newSub })
        });
      })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evt) => evt.waitUntil(self.clients.claim()));

self.addEventListener("message", (evt) => {
  if (evt.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
