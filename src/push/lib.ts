import { AppUtils } from "@/common/utils";
import { publicKey, host } from "./config";
import { STATUS } from "./global";

let register: Promise<ServiceWorkerRegistration>;

export function notificationSubscribe(
  address: string
): Promise<PushSubscription | typeof STATUS.not_supported | typeof STATUS.permission_denied> {
  try {
    return requestPermissions(address);
  } catch (e) {
    throw e;
  }
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
    register = navigator.serviceWorker.register(`/worker.js`, { scope: "/" });
  }
  return register;
}

export async function requestPermissions(
  address: string
): Promise<PushSubscription | typeof STATUS.not_supported | typeof STATUS.permission_denied> {
  return Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      return initSW(address);
    }
    return STATUS.permission_denied;
  });
}

export async function subscribe(subscription: PushSubscription | null, address: string): Promise<string> {
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

export async function initWorker() {
  try {
    const lang = AppUtils.getLang();
    AppUtils.setLangDb(lang.key);
    await getWorker();
  } catch (e) {
    console.error(e);
  }
}
