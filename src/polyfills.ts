// src/polyfills.ts
import { Buffer } from "buffer";

declare global {
  var Buffer: typeof Buffer;
}

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
