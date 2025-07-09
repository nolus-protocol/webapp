import { STATUS } from "./global.ts";
import { host } from "./config";

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
