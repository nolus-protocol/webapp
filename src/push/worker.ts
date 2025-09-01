/// <reference lib="webworker" />

declare global {
  interface PushSubscriptionChangeEvent extends ExtendableEvent {
    oldSubscription: PushSubscription | null;
  }
}

declare const self: ServiceWorkerGlobalScope;

import type { IObjectKeys } from "@/common/types/IObjectKeys.ts";
import { truncateString, urlB64ToUint8Array } from "./helpers.ts";
import { publicKey, redirect } from "./config.ts";
import { host } from "./config.ts";
import { translate } from "./locales.ts";
import { DefaultLtv, PushNotifications } from "./global.ts";
import { idbGet } from "./database.ts";

const icon = "/icons/icon-128x128.png";
const defaultLanguage = "en";
const permille = 1000;
const version = 1;

async function handlePushEvent(event: PushEvent) {
  let payload: IObjectKeys = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    console.error("Failed to parse push payload:", err);
  }

  const [title, notification] = await parseNotification(payload);
  return self.registration.showNotification(title, notification);
}

async function parseNotification(payload: IObjectKeys): Promise<[string, NotificationOptions]> {
  const lang = (await idbGet("language")) ?? defaultLanguage;
  switch (payload.type) {
    case PushNotifications.Funding: {
      const [title, message] = await Promise.all([
        translate(lang, "ltv-title", { percent: payload.data.ltv / permille }),
        translate(lang, "liquidations-funding", { ticker: truncateString(payload.data.position, 8, 8) })
      ]);

      const notification: NotificationOptions = {
        body: message,
        icon: icon,
        badge: icon,
        data: {
          url: `${redirect}leases`,
          timestamp: Date.now()
        }
      };
      return [title, notification];
    }
    case PushNotifications.FundingRecommended: {
      const [title, message] = await Promise.all([
        translate(lang, "ltv-title-risk", { percent: payload.data.ltv / permille }),
        translate(lang, "liquidations-funding-recommended", { ticker: truncateString(payload.data.position, 8, 8) })
      ]);

      const notification: NotificationOptions = {
        body: message,
        icon: icon,
        badge: icon,
        data: {
          url: `${redirect}leases`,
          timestamp: Date.now()
        }
      };
      return [title, notification];
    }
    case PushNotifications.FundNow: {
      const [title, message] = await Promise.all([
        translate(lang, "ltv-title-high-risk", { percent: payload.data.ltv / permille }),
        translate(lang, "liquidations-fund-now", { ticker: truncateString(payload.data.position, 8, 8) })
      ]);

      const notification: NotificationOptions = {
        body: message,
        icon: icon,
        badge: icon,
        data: {
          url: `${redirect}leases`,
          timestamp: Date.now()
        }
      };
      return [title, notification];
    }
    case PushNotifications.PartiallyLiquidated: {
      const [title, message] = await Promise.all([
        translate(lang, "ltv-title-partial-liquidation", {}),
        translate(lang, "liquidations-partially-liquidated", {
          ticker: truncateString(payload.data.position, 8, 8),
          percent: DefaultLtv / permille
        })
      ]);

      const notification: NotificationOptions = {
        body: message,
        icon: icon,
        badge: icon,
        data: {
          url: `${redirect}leases`,
          timestamp: Date.now()
        }
      };
      return [title, notification];
    }
    case PushNotifications.FullyLiquidated: {
      const [title, message] = await Promise.all([
        translate(lang, "ltv-title-full-liquidation", {}),
        translate(lang, "liquidations-fully-liquidated", {
          ticker: truncateString(payload.data.position, 8, 8)
        })
      ]);

      const notification: NotificationOptions = {
        body: message,
        icon: icon,
        badge: icon,
        data: {
          url: `${redirect}leases`,
          timestamp: Date.now()
        }
      };
      return [title, notification];
    }
  }

  const notification: NotificationOptions = {
    body: "You have a new notification.",
    icon: icon,
    badge: icon,
    data: {
      url: redirect,
      timestamp: Date.now()
    }
  };

  return ["Notification", notification];
}

self.addEventListener("push", async (event) => {
  event.waitUntil(handlePushEvent(event));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url;
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

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(self.clients.claim());
});
