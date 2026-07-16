import { WebSocket } from "ws";
import type { LookupFunction } from "node:net";
import { WS_ACK_TIMEOUT_MS } from "./config.js";
import { parseBalanceUpdateFrame } from "./validate.js";
import type { BalanceUpdateFrame } from "./types.js";

const BALANCES_TOPIC = "balances";

export class WsAckError extends Error {}

export interface BalanceSubscriptionResult {
  update: BalanceUpdateFrame | null;
}

interface ServerFrame {
  type: string;
  topic?: string;
  code?: string;
  message?: string;
}

function parseFrame(data: unknown): ServerFrame | null {
  const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : null;
  if (text === null) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.type !== "string") {
    return null;
  }
  return record as unknown as ServerFrame;
}

function subscribeFrame(action: "subscribe" | "unsubscribe", address: string): string {
  return JSON.stringify({ type: action, topic: BALANCES_TOPIC, address });
}

function waitForOpen(socket: WebSocket, timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      cleanup();
      rejectPromise(new WsAckError(`WebSocket did not open within ${timeoutMs}ms`));
    }, timeoutMs);

    const onOpen = (): void => {
      cleanup();
      resolvePromise();
    };
    const onError = (error: Error): void => {
      cleanup();
      rejectPromise(new WsAckError(`WebSocket connection failed: ${error.message}`));
    };
    const onClose = (): void => {
      cleanup();
      rejectPromise(new WsAckError("WebSocket closed before opening"));
    };

    function cleanup(): void {
      clearTimeout(timer);
      socket.off("open", onOpen);
      socket.off("error", onError);
      socket.off("close", onClose);
    }

    socket.on("open", onOpen);
    socket.on("error", onError);
    socket.on("close", onClose);
  });
}

function waitForAck(socket: WebSocket, topic: string, timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      cleanup();
      rejectPromise(new WsAckError(`No "subscribed" ack for topic "${topic}" within ${timeoutMs}ms`));
    }, timeoutMs);

    const onMessage = (data: unknown): void => {
      const frame = parseFrame(data);
      if (frame === null) {
        return;
      }
      if (frame.type === "error") {
        cleanup();
        rejectPromise(new WsAckError(`Server error frame: code=${frame.code ?? "?"} message=${frame.message ?? "?"}`));
        return;
      }
      if (frame.type === "subscribed" && frame.topic === topic) {
        cleanup();
        resolvePromise();
      }
    };
    const onError = (error: Error): void => {
      cleanup();
      rejectPromise(new WsAckError(`WebSocket error while awaiting ack: ${error.message}`));
    };
    const onClose = (): void => {
      cleanup();
      rejectPromise(new WsAckError("WebSocket closed before ack"));
    };

    function cleanup(): void {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("error", onError);
      socket.off("close", onClose);
    }

    socket.on("message", onMessage);
    socket.on("error", onError);
    socket.on("close", onClose);
  });
}

function waitForBalanceUpdate(
  socket: WebSocket,
  address: string,
  timeoutMs: number
): Promise<BalanceUpdateFrame | null> {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      cleanup();
      resolvePromise(null);
    }, timeoutMs);

    const onMessage = (data: unknown): void => {
      const frame = parseFrame(data);
      if (frame === null || frame.type !== "balance_update") {
        return;
      }
      let parsed: BalanceUpdateFrame;
      try {
        parsed = parseBalanceUpdateFrame(frame);
      } catch {
        return;
      }
      if (parsed.address !== address) {
        return;
      }
      cleanup();
      resolvePromise(parsed);
    };
    const onClose = (): void => {
      cleanup();
      resolvePromise(null);
    };

    function cleanup(): void {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("close", onClose);
    }

    socket.on("message", onMessage);
    socket.on("close", onClose);
  });
}

function closeQuietly(socket: WebSocket): void {
  socket.removeAllListeners();
  socket.on("error", () => undefined);
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    socket.close();
  }
}

export async function runBalanceSubscription(options: {
  wsUrl: string;
  address: string;
  pushTimeoutMs: number;
  lookup?: LookupFunction | undefined;
}): Promise<BalanceSubscriptionResult> {
  const socket = new WebSocket(options.wsUrl, options.lookup ? { lookup: options.lookup } : {});
  try {
    await waitForOpen(socket, WS_ACK_TIMEOUT_MS);
    socket.send(subscribeFrame("subscribe", options.address));
    await waitForAck(socket, BALANCES_TOPIC, WS_ACK_TIMEOUT_MS);
    const update = await waitForBalanceUpdate(socket, options.address, options.pushTimeoutMs);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(subscribeFrame("unsubscribe", options.address));
    }
    return { update };
  } finally {
    closeQuietly(socket);
  }
}
