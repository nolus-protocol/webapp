export type DeviceInfo = {
  isMobile: boolean;
  os: "iOS" | "Android" | "Unknown";
};

export function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";

  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

  let os: DeviceInfo["os"] = "Unknown";
  if (/android/i.test(ua)) {
    os = "Android";
  } else if (/iPad|iPhone|iPod/.test(ua)) {
    os = "iOS";
  }

  return { isMobile, os };
}
