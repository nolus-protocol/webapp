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

export function parseFrame(data: unknown): ServerFrame | null {
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
  // Sanctioned assertion: a typeof/null guard narrows to non-null `object` but cannot
  // give TypeScript an index signature, so reading fields needs this cast. Each field
  // below is then individually type-checked; no unchecked field reaches the result.
  const record = value as Record<string, unknown>;
  if (typeof record.type !== "string") {
    return null;
  }
  const frame: ServerFrame = { type: record.type };
  if (typeof record.topic === "string") {
    frame.topic = record.topic;
  }
  if (typeof record.code === "string") {
    frame.code = record.code;
  }
  if (typeof record.message === "string") {
    frame.message = record.message;
  }
  return frame;
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

function matchBalanceUpdate(data: unknown, address: string): BalanceUpdateFrame | null {
  const frame = parseFrame(data);
  if (frame === null || frame.type !== "balance_update") {
    return null;
  }
  let parsed: BalanceUpdateFrame;
  try {
    parsed = parseBalanceUpdateFrame(frame);
  } catch {
    return null;
  }
  return parsed.address === address ? parsed : null;
}

// Push-wait phase: a missing push (timeout), a peer close, or a transport error all
// resolve `null` (no push observed). The `error` listener is load-bearing: without it a
// socket `error` in this window is an unhandled EventEmitter event, which crashes the
// process before t0.json is written and the later checks run.
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
      const match = matchBalanceUpdate(data, address);
      if (match !== null) {
        cleanup();
        resolvePromise(match);
      }
    };
    const onSettleNull = (): void => {
      cleanup();
      resolvePromise(null);
    };

    function cleanup(): void {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("close", onSettleNull);
      socket.off("error", onSettleNull);
    }

    socket.on("message", onMessage);
    socket.on("close", onSettleNull);
    socket.on("error", onSettleNull);
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
