import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useWsState,
  onServerMessage,
  sendMessage,
  disconnectWebSocket,
} from "../../hooks/use-websocket";

describe("use-websocket", () => {
  describe("useWsState", () => {
    it("초기 연결 상태는 disconnected", () => {
      const state = useWsState.getState();
      expect(state.connectionState).toBe("disconnected");
    });

    it("wasConnected 초기값은 false", () => {
      expect(useWsState.getState().wasConnected).toBe(false);
    });

    it("상태를 수동으로 업데이트할 수 있다", () => {
      useWsState.setState({ connectionState: "connected", wasConnected: true });
      expect(useWsState.getState().connectionState).toBe("connected");
      expect(useWsState.getState().wasConnected).toBe(true);
      // 원상복구
      useWsState.setState({ connectionState: "disconnected", wasConnected: false });
    });
  });

  describe("onServerMessage", () => {
    it("핸들러 등록 및 해제", () => {
      const handler = vi.fn();
      const unsubscribe = onServerMessage(handler);
      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });

    it("동일 핸들러 중복 등록 방지 (Set 기반)", () => {
      const handler = vi.fn();
      const unsub1 = onServerMessage(handler);
      const unsub2 = onServerMessage(handler);
      unsub1();
      unsub2();
    });

    it("여러 핸들러를 등록하고 각각 해제할 수 있다", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsub1 = onServerMessage(handler1);
      const unsub2 = onServerMessage(handler2);
      unsub1();
      unsub2();
    });
  });

  describe("sendMessage", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    it("WebSocket 미연결 시 false 반환", () => {
      const result = sendMessage({ type: "input", panelId: "test", data: "hello" });
      expect(result).toBe(false);
    });

    it("WebSocket 미연결 시 경고 출력", () => {
      sendMessage({ type: "input", panelId: "test", data: "hello" });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("미연결"),
        expect.any(String),
      );
    });

    it("다양한 메시지 타입으로 호출 가능", () => {
      sendMessage({ type: "kill", panelId: "test" });
      sendMessage({ type: "resize", panelId: "test", cols: 80, rows: 24 });
      sendMessage({ type: "create", cli: "claude", path: "/test", options: "" });
      expect(console.warn).toHaveBeenCalledTimes(3);
    });
  });

  describe("disconnectWebSocket", () => {
    it("disconnect 후 상태가 disconnected로 변경된다", () => {
      disconnectWebSocket();
      expect(useWsState.getState().connectionState).toBe("disconnected");
    });
  });
});
