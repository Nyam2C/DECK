import { useEffect } from "react";
import { Toolbar } from "./components/Toolbar";
import { Grid } from "./components/Grid";
import { Settings } from "./components/Settings";
import { useSettingsStore } from "./stores/settings-store";
import { usePanelStore } from "./stores/panel-store";
import {
  useWebSocketInit,
  useWsState,
  onServerMessage,
  connectWebSocket,
} from "./hooks/use-websocket";

export function App() {
  const isSettingsOpen = useSettingsStore((s) => s.isOpen);
  const connectionState = useWsState((s) => s.connectionState);
  const wasConnected = useWsState((s) => s.wasConnected);

  // WebSocket 연결 초기화
  useWebSocketInit();

  // 서버 메시지 라우팅
  useEffect(() => {
    // "input" 진입 시각 기록 — 프롬프트 렌더링 출력과 실제 응답을 구분하기 위한 디바운스
    const inputEnteredAt = new Map<string, number>();
    const INPUT_GRACE_MS = 2000;

    return onServerMessage((msg) => {
      const { updatePanel, setStatus } = usePanelStore.getState();

      switch (msg.type) {
        case "output": {
          // "input" 상태에서 유예 시간 이후 출력 발생 → 사용자가 응답했으므로 "active"로 복귀
          const enteredAt = inputEnteredAt.get(msg.panelId);
          if (enteredAt !== undefined && Date.now() - enteredAt > INPUT_GRACE_MS) {
            setStatus(msg.panelId, "active");
            inputEnteredAt.delete(msg.panelId);
          }
          break;
        }
        case "exited":
          updatePanel(msg.panelId, { status: "exited", exitCode: msg.exitCode });
          inputEnteredAt.delete(msg.panelId);
          break;
        case "status":
          setStatus(msg.panelId, msg.state);
          break;
        case "hook-status":
          updatePanel(msg.panelId, { hookConnected: msg.connected });
          break;
        case "hook-notify":
          setStatus(msg.panelId, "input");
          inputEnteredAt.set(msg.panelId, Date.now());
          break;
        case "error":
          // PanelSetup에서 개별 처리하므로 panelId 없는 글로벌 에러만 로깅
          if (!msg.panelId) {
            console.error("[DECK] 서버 에러:", msg.message);
          }
          break;
      }
    });
  }, []);

  // beforeunload 경고 (활성 세션이 있을 때)
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const { panels } = usePanelStore.getState();
      const hasActive = panels.some(
        (p) => p.status === "active" || p.status === "idle" || p.status === "input",
      );
      if (hasActive) {
        e.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // 서버 연결 끊김 → 모든 running 패널 exited 전환
  useEffect(() => {
    return useWsState.subscribe((state, prev) => {
      if (prev.wasConnected && state.connectionState === "disconnected") {
        const { panels, updatePanel } = usePanelStore.getState();
        for (const p of panels) {
          if (p.status === "active" || p.status === "idle" || p.status === "input") {
            updatePanel(p.id, { status: "exited", exitCode: -1 });
          }
        }
      }
    });
  }, []);

  // 탭 타이틀 동적 업데이트
  useEffect(() => {
    return usePanelStore.subscribe((state) => {
      const active = state.panels.filter(
        (p) => p.status === "active" || p.status === "idle",
      ).length;
      const waiting = state.panels.filter((p) => p.status === "input").length;
      const parts: string[] = [];
      if (active > 0) parts.push(`${active} active`);
      if (waiting > 0) parts.push(`${waiting} waiting`);
      document.title = parts.length > 0 ? `DECK — ${parts.join(", ")}` : "DECK";
    });
  }, []);

  return (
    <div className="bg-deck-bg dot-grid-bg text-deck-text font-dot h-screen flex flex-col overflow-hidden select-none">
      <Toolbar />

      {/* 스캔라인 구분선 */}
      <div className="text-center text-deck-border text-[10px] leading-none py-0.5 tracking-[0.5em] overflow-hidden whitespace-nowrap shrink-0">
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
      </div>

      <Grid />

      {isSettingsOpen && <Settings />}

      {/* 다른 탭에서 연결됨 오버레이 */}
      {connectionState === "replaced" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-deck-panel border border-deck-pink p-6 text-center space-y-3">
            <div className="text-deck-pink text-sm">다른 탭에서 DECK에 연결되었습니다</div>
            <div className="text-deck-dim text-xs">동시에 하나의 탭만 사용할 수 있습니다</div>
            <button
              onClick={() => {
                connectWebSocket();
              }}
              className="px-4 py-1.5 text-xs border border-deck-pink text-deck-pink hover:bg-deck-pink/15 transition-colors"
            >
              이 탭에서 다시 연결
            </button>
          </div>
        </div>
      )}

      {/* 연결 끊김 오버레이 — 한 번이라도 연결된 후 끊긴 경우에만 표시 */}
      {wasConnected && connectionState === "disconnected" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-deck-panel border border-deck-border p-6 text-center space-y-2">
            <div className="text-deck-pink text-sm">서버 연결이 끊어졌습니다</div>
            <div className="text-deck-dim text-xs">자동 재연결 시도 중...</div>
          </div>
        </div>
      )}
    </div>
  );
}
