import type { IObjectKeys } from "@/common/types";
import { Buffer } from "buffer";

export function urlB64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = Buffer.from(base64, "base64").toString();
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function templateParser(expression: string, valueObj: IObjectKeys) {
  const templateMatcher = /{{\s?([^{}\s]*)\s?}}/g;
  return expression.replace(templateMatcher, (_substring: string, value: string) => {
    const keys = value.split(".");
    const parsedValue = keys.reduce((acc, key) => {
      acc = acc[key];
      return acc;
    }, valueObj);
    return String(parsedValue);
  });
}

export function truncateString(str: string, front: number, back: number): string {
  return `${str.substring(0, front)}...${str.substring(str.length - back, str.length)}`;
}
