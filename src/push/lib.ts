import { publicKey } from "./config";
import { STATUS } from "./global";
import { subscribe } from "./subscribe";

let register: Promise<ServiceWorkerRegistration>;

export function notificationSubscribe(
  address: string
): Promise<PushSubscription | typeof STATUS.not_supported | typeof STATUS.permission_denied> {
  try {
    return requestPermissions(address);
  } catch (e) {
    console.error(e);
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
    subscribeUser(register, address);
  }
  return Promise.resolve(STATUS.not_supported);
}

function getWorker() {
  if (!register) {
    register = navigator.serviceWorker.register(`./worker.js`);
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

export async function initWorker() {
  try {
    const register = await getWorker();

    if (register.waiting) {
      register.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    register.addEventListener("updatefound", () => {
      const newSW = register.installing!;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed") {
          newSW.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  } catch (e) {
    console.error(e);
  }
}
