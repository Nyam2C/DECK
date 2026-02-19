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
  sendMessage,
} from "./hooks/use-websocket";
import { useKeyboard } from "./hooks/use-keyboard";
import { ensureResumeFlag } from "./services/cli-provider";

export function App() {
  const isSettingsOpen = useSettingsStore((s) => s.isOpen);
  const theme = useSettingsStore((s) => s.theme);
  const connectionState = useWsState((s) => s.connectionState);
  const wasConnected = useWsState((s) => s.wasConnected);
  const { leaderActive } = useKeyboard();

  // 테마 적용
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // WebSocket 연결 초기화
  useWebSocketInit();

  // startBehavior에 따라 localStorage 패널 처리
  useEffect(() => {
    const { startBehavior } = useSettingsStore.getState();
    if (startBehavior === "empty") {
      // "빈 상태로 시작" → localStorage 패널 제거
      usePanelStore.setState({ panels: [], focusedId: null, pinnedId: null });
    }
  }, []);

  // 서버 메시지 라우팅
  useEffect(() => {
    // 상태 진입 시각 기록 — 잔여 출력과 실제 응답을 구분하기 위한 디바운스
    const inputEnteredAt = new Map<string, number>();
    const idleEnteredAt = new Map<string, number>();
    const INPUT_GRACE_MS = 2000;
    const IDLE_GRACE_MS = 3000;

    return onServerMessage((msg) => {
      const { updatePanel, setStatus } = usePanelStore.getState();

      switch (msg.type) {
        case "output": {
          const panel = usePanelStore.getState().panels.find((p) => p.id === msg.panelId);

          if (panel?.status === "idle") {
            const idleAt = idleEnteredAt.get(msg.panelId);
            if (idleAt === undefined || Date.now() - idleAt > IDLE_GRACE_MS) {
              setStatus(msg.panelId, "active");
              idleEnteredAt.delete(msg.panelId);
            }
          }
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
          if (msg.message === "stop") {
            setStatus(msg.panelId, "idle");
            idleEnteredAt.set(msg.panelId, Date.now());
          } else {
            setStatus(msg.panelId, "input");
            inputEnteredAt.set(msg.panelId, Date.now());
          }
          break;
        case "error":
          // PanelSetup에서 개별 처리하므로 panelId 없는 글로벌 에러만 로깅
          if (!msg.panelId) {
            console.error("[DECK] 서버 에러:", msg.message);
          }
          break;
        case "restore-session": {
          // preset source이면 startBehavior 무시하고 항상 로드
          if (msg.source !== "preset") {
            const startBehavior = useSettingsStore.getState().startBehavior;
            if (startBehavior !== "restore") break;
          }

          // localStorage에서 복원된 기존 패널 제거 (서버 데이터로 새로 생성)
          usePanelStore.setState({ panels: [], focusedId: null, pinnedId: null });

          for (const pp of msg.panels) {
            const id = usePanelStore.getState().addPanel();
            if (!id) break;
            const options = pp.cli === "claude" ? ensureResumeFlag(pp.options) : pp.options;
            usePanelStore.getState().updatePanel(id, {
              name: pp.path.split("/").pop() || "패널",
              cli: pp.cli,
              path: pp.path,
              options,
              status: "active",
            });
            sendMessage({ type: "create", panelId: id, cli: pp.cli, path: pp.path, options });
          }
          break;
        }
        case "sync": {
          // 살아있는 PTY 세션에 재접속 — 서버 ID를 그대로 사용
          const panels: import("./types").Panel[] = msg.sessions.map((s) => ({
            id: s.id,
            name: s.cwd.split("/").pop() || "패널",
            cli: s.cli,
            path: s.cwd,
            options: s.options,
            status: "active" as const,
            hookConnected: null,
          }));

          usePanelStore.setState({
            panels,
            focusedId: panels[0]?.id ?? null,
            pinnedId: null,
          });

          for (const s of msg.sessions) {
            sendMessage({ type: "attach", panelId: s.id, cols: 80, rows: 24 });
          }
          break;
        }
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

  // 다른 탭에서 교체됨 → 모든 running 패널 exited 전환
  // 일반 disconnected는 재연결 시도 중이므로 패널 상태 유지
  useEffect(() => {
    return useWsState.subscribe((state, prev) => {
      if (prev.wasConnected && state.connectionState === "replaced") {
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

      {/* 구분선 */}
      <div className="text-center text-deck-border text-[10px] leading-none py-0.5 tracking-[0.5em] overflow-hidden whitespace-nowrap shrink-0">
        {theme === "miku"
          ? "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░"
          : "\u00A0"}
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

      {/* Leader Key 인디케이터 */}
      {leaderActive && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-deck-panel border border-deck-cyan px-4 py-1.5 text-xs text-deck-cyan animate-fade-in">
          Ctrl+Space <span className="text-deck-dim">···</span> 키를 입력하세요
        </div>
      )}
    </div>
  );
}
