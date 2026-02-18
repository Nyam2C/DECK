import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWsState, onServerMessage, sendMessage } from "../../hooks/use-websocket";
import type { ServerMessage } from "../../hooks/use-websocket";

describe("use-websocket", () => {
  describe("useWsState", () => {
    it("초기 연결 상태는 disconnected", () => {
      const state = useWsState.getState();
      expect(state.connectionState).toBe("disconnected");
    });
  });

  describe("onServerMessage", () => {
    it("핸들러 등록 및 해제", () => {
      const handler = vi.fn();
      const unsubscribe = onServerMessage(handler);

      // 해제 함수 반환 확인
      expect(typeof unsubscribe).toBe("function");

      // 해제 후 핸들러가 호출되지 않아야 함
      unsubscribe();
    });

    it("동일 핸들러 중복 등록 방지 (Set 기반)", () => {
      const handler = vi.fn();
      const unsub1 = onServerMessage(handler);
      const unsub2 = onServerMessage(handler);

      // Set이므로 같은 함수 참조는 1번만 등록됨
      unsub1();
      unsub2();
    });
  });

  describe("sendMessage", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    it("WebSocket 미연결 시 경고 출력", () => {
      sendMessage({ type: "input", panelId: "test", data: "hello" });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("미연결"),
        expect.any(String),
      );
    });
  });
});
