/**
 * Tests for WebSocketClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketClientImpl } from "./WebSocketClient";

// Extended MockWebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  sentMessages: string[] = [];

  constructor(public url: string) {}

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { code, reason }));
    }
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }
}

describe("WebSocketClientImpl", () => {
  let client: WebSocketClientImpl;
  let mockWs: MockWebSocket;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    
    originalWebSocket = global.WebSocket as typeof WebSocket;
    
    // Create mock WebSocket constructor
    global.WebSocket = vi.fn((url: string) => {
      mockWs = new MockWebSocket(url);
      return mockWs as unknown as WebSocket;
    }) as unknown as typeof WebSocket;
    
    Object.assign(global.WebSocket, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });

    client = new WebSocketClientImpl({
      url: "ws://test:3000/ws",
      reconnectInterval: 1000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    client.disconnect();
  });

  describe("connection", () => {
    it("should connect to WebSocket server", async () => {
      const connectPromise = client.connect();
      
      // Simulate successful connection
      mockWs.simulateOpen();
      
      await connectPromise;

      expect(client.getConnectionState()).toBe("connected");
      expect(global.WebSocket).toHaveBeenCalledWith("ws://test:3000/ws");
    });

    it("should update connection state during connection", async () => {
      const states: string[] = [];
      client.onConnectionStateChange((state) => states.push(state));

      const connectPromise = client.connect();
      
      expect(states).toContain("connecting");
      
      mockWs.simulateOpen();
      await connectPromise;

      expect(states).toContain("connected");
    });

    it("should disconnect cleanly", async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      client.disconnect();

      expect(client.getConnectionState()).toBe("disconnected");
    });
  });

  describe("subscriptions", () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;
    });

    it("should subscribe to prices", () => {
      const callback = vi.fn();
      client.subscribePrices(callback);

      expect(mockWs.sentMessages).toHaveLength(1);
      const message = JSON.parse(mockWs.sentMessages[0]);
      expect(message.type).toBe("subscribe");
      expect(message.topic).toBe("prices");
    });

    it("should subscribe to balances with address", () => {
      const callback = vi.fn();
      client.subscribeBalances("addr1", callback);

      const message = JSON.parse(mockWs.sentMessages[0]);
      expect(message.type).toBe("subscribe");
      expect(message.topic).toBe("balances");
      // Params are spread at top level due to backend's serde(flatten)
      expect(message.address).toBe("addr1");
    });

    it("should subscribe to leases with owner", () => {
      const callback = vi.fn();
      client.subscribeLeases("owner1", callback);

      const message = JSON.parse(mockWs.sentMessages[0]);
      expect(message.topic).toBe("leases");
      // Params are spread at top level due to backend's serde(flatten)
      expect(message.address).toBe("owner1");
    });

    it("should subscribe to tx status", () => {
      const callback = vi.fn();
      client.subscribeTxStatus("txhash1", "pirin-1", callback);

      const message = JSON.parse(mockWs.sentMessages[0]);
      expect(message.topic).toBe("tx_status");
      // Params are spread at top level due to backend's serde(flatten)
      expect(message.hash).toBe("txhash1");
      expect(message.chain_id).toBe("pirin-1");
    });

    it("should unsubscribe when callback is removed", () => {
      const callback = vi.fn();
      const unsubscribe = client.subscribePrices(callback);

      mockWs.sentMessages = []; // Clear subscribe message
      unsubscribe();

      expect(mockWs.sentMessages).toHaveLength(1);
      const message = JSON.parse(mockWs.sentMessages[0]);
      expect(message.type).toBe("unsubscribe");
      expect(message.topic).toBe("prices");
    });

    it("should not unsubscribe if other callbacks exist", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      const unsub1 = client.subscribePrices(callback1);
      client.subscribePrices(callback2);

      mockWs.sentMessages = [];
      unsub1();

      // Should not send unsubscribe since callback2 still exists
      expect(mockWs.sentMessages).toHaveLength(0);
    });
  });

  describe("message handling", () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;
    });

    it("should handle price updates", () => {
      const callback = vi.fn();
      client.subscribePrices(callback);

      mockWs.simulateMessage({
        type: "price_update",
        prices: { NLS: { price: "0.15", timestamp: 123 } },
      });

      expect(callback).toHaveBeenCalledWith({ NLS: { price: "0.15", timestamp: 123 } });
    });

    it("should handle balance updates", () => {
      const callback = vi.fn();
      client.subscribeBalances("addr1", callback);

      mockWs.simulateMessage({
        type: "balance_update",
        address: "addr1",
        balances: { unls: "1000000" },
      });

      expect(callback).toHaveBeenCalledWith("addr1", { unls: "1000000" });
    });

    it("should handle lease updates", () => {
      const callback = vi.fn();
      client.subscribeLeases("owner1", callback);

      const lease = {
        address: "lease1",
        owner: "owner1",
        status: { type: "opened" },
      };

      mockWs.simulateMessage({
        type: "lease_update",
        lease,
      });

      expect(callback).toHaveBeenCalledWith(lease);
    });

    it("should handle tx status updates", () => {
      const callback = vi.fn();
      client.subscribeTxStatus("tx1", "pirin-1", callback);

      mockWs.simulateMessage({
        type: "tx_status",
        tx_hash: "tx1",
        status: "success",
      });

      expect(callback).toHaveBeenCalledWith("tx1", "success", undefined);
    });

    it("should handle subscribed confirmation", () => {
      client.subscribePrices(vi.fn());

      // Should not throw
      mockWs.simulateMessage({
        type: "subscribed",
        topic: "prices",
      });

      expect(client.getConnectionState()).toBe("connected");
    });

    it("should handle error messages", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      mockWs.simulateMessage({
        type: "error",
        message: "Test error",
        topic: "prices",
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("reconnection", () => {
    it("should schedule reconnection on disconnect", async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      // Simulate unexpected close
      mockWs.close();

      expect(client.getConnectionState()).toBe("reconnecting");
    });

    it("should resubscribe after reconnection", async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      const callback = vi.fn();
      client.subscribePrices(callback);
      mockWs.sentMessages = [];

      // Simulate disconnect and reconnect
      mockWs.close();
      
      vi.advanceTimersByTime(1000);
      mockWs.simulateOpen();

      // Should have resubscribed
      expect(mockWs.sentMessages.some(m => {
        const msg = JSON.parse(m);
        return msg.type === "subscribe" && msg.topic === "prices";
      })).toBe(true);
    });
  });

  describe("connection state callbacks", () => {
    it("should notify on state change", async () => {
      const callback = vi.fn();
      const unsubscribe = client.onConnectionStateChange(callback);

      // Should immediately call with current state
      expect(callback).toHaveBeenCalledWith("disconnected");

      const connectPromise = client.connect();
      expect(callback).toHaveBeenCalledWith("connecting");

      mockWs.simulateOpen();
      await connectPromise;
      expect(callback).toHaveBeenCalledWith("connected");

      unsubscribe();
    });

    it("should allow unsubscribing from state changes", async () => {
      const callback = vi.fn();
      const unsubscribe = client.onConnectionStateChange(callback);

      callback.mockClear();
      unsubscribe();

      client.connect();
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
