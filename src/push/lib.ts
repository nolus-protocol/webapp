import { getLanguage, setLanguageDb } from "@/common/utils/LanguageUtils";
import { publicKey, host } from "./config";
import { STATUS } from "./global";

let register: Promise<ServiceWorkerRegistration> | null = null;

export function notificationSubscribe(
  address: string
): Promise<PushSubscription | typeof STATUS.not_supported | typeof STATUS.permission_denied> {
  return requestPermissions(address);
}

async function subscribeUser(
  swRegistration: ServiceWorkerRegistration,
  address: string
): Promise<Awaited<ReturnType<typeof subscribe>>> {
  const subscription = await swRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey
  });
  return await subscribe(subscription, address);
}

async function initSW(address: string): Promise<PushSubscription | typeof STATUS.not_supported> {
  if ("serviceWorker" in navigator) {
    const register = await getWorker();
    return subscribeUser(register, address);
  }
  return Promise.resolve(STATUS.not_supported);
}

function getWorker() {
  if (!register) {
    // Clear the cached promise on rejection so the next call retries a fresh
    // register() — otherwise a single transient failure (404 after deploy,
    // bad MIME, etc.) would poison the cache until full page reload.
    register = navigator.serviceWorker.register(`/worker.js`, { scope: "/" }).catch((err) => {
      register = null;
      throw err;
    });
  }
  return register;
}

async function requestPermissions(
  address: string
): Promise<PushSubscription | typeof STATUS.not_supported | typeof STATUS.permission_denied> {
  return Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      return initSW(address);
    }
    return STATUS.permission_denied;
  });
}

async function subscribe(subscription: PushSubscription | null, address: string): Promise<string> {
  if (subscription) {
    const item = { address, data: subscription };
    const response = await fetch(`${host}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    const text = await response.text();
    return text === STATUS.subscribed ? STATUS.subscribed : text;
  }
  return Promise.resolve(STATUS.rejected);
}

export async function getSubscriptionStatus(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const sw = await getWorker();
    const subscription = await sw.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

export async function notificationUnsubscribe(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const sw = await getWorker();
    const subscription = await sw.pushManager.getSubscription();
    if (subscription) {
      return subscription.unsubscribe();
    }
  } catch {
    // ignore
  }
  return false;
}

export async function initWorker() {
  try {
    const lang = getLanguage();
    setLanguageDb(lang.key);
    await getWorker();
  } catch (e) {
    console.error(e);
  }
}
