import { useRef, useState } from "react";
import { usePanelStore } from "../stores/panel-store";
import { PanelSetup } from "./PanelSetup";
import { useTerminal } from "../hooks/use-terminal";
import { sendMessage } from "../hooks/use-websocket";
import type { Panel as PanelType, PanelStatus } from "../types";

interface PanelProps {
  panel: PanelType;
  spanClassName: string;
}

/** 상태별 보더/글로우 클래스 */
function getStatusClasses(status: PanelStatus, isFocused: boolean): string {
  if (isFocused && (status === "active" || status === "idle")) {
    return "border-deck-cyan animate-glow";
  }
  if (status === "input") {
    return "border-deck-gold animate-glow-gold";
  }
  return "border-dashed border-deck-border";
}

/** 상태별 아이콘 */
function getStatusIcon(status: PanelStatus, isFocused: boolean): { icon: string; color: string } {
  if (status === "input") return { icon: "■", color: "text-deck-gold" };
  if (isFocused && status !== "setup" && status !== "exited")
    return { icon: "■", color: "text-deck-cyan" };
  return { icon: "□", color: "text-deck-dim" };
}

/** 상태별 상태 텍스트 */
function getStatusLabel(status: PanelStatus): { text: string; color: string } | null {
  switch (status) {
    case "active":
      return { text: "▪▪▪ active ▪▪▪", color: "text-deck-cyan" };
    case "idle":
      return { text: "▪▪ idle ▪▪", color: "text-deck-pink" };
    case "input":
      return { text: "▪▪▪ input ▪▪▪", color: "text-deck-gold" };
    case "exited":
      return { text: "▪ exited ▪", color: "text-deck-dim" };
    default:
      return null;
  }
}

/** 터미널 뷰 — xterm.js 렌더링 */
function TerminalView({ panelId }: { panelId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal({ panelId, containerRef });
  return <div ref={containerRef} className="w-full h-full pl-2" />;
}

/** 종료 코드별 설명 메시지 */
function getExitMessage(exitCode: number | undefined): string {
  switch (exitCode) {
    case 0:
      return "세션이 정상 종료되었습니다";
    case 130:
      return "세션이 중단되었습니다";
    case 137:
      return "세션이 비정상 종료되었습니다";
    case 143:
      return "세션이 종료되었습니다";
    case -1:
      return "서버 연결이 끊어졌습니다";
    default:
      return "세션이 비정상 종료되었습니다";
  }
}

/** 종료 뷰 — 종료 코드 + 재시작/닫기 버튼 */
function ExitedView({ panel }: { panel: PanelType }) {
  const updatePanel = usePanelStore((s) => s.updatePanel);
  const removePanel = usePanelStore((s) => s.removePanel);

  function handleRestart() {
    sendMessage({
      type: "create",
      panelId: panel.id,
      cli: panel.cli,
      path: panel.path,
      options: panel.options,
    });
    updatePanel(panel.id, { status: "active", exitCode: undefined });
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
      <span className="text-deck-dim text-xs">{getExitMessage(panel.exitCode)}</span>
      <span className="text-deck-border text-[10px]">코드: {panel.exitCode ?? "?"}</span>
      <div className="flex gap-2">
        <button
          onClick={handleRestart}
          className="px-3 py-1 text-xs border border-deck-cyan text-deck-cyan hover:bg-deck-cyan/15 transition-colors"
        >
          재시작
        </button>
        <button
          onClick={() => removePanel(panel.id)}
          className="px-3 py-1 text-xs border border-dashed border-deck-border text-deck-dim hover:text-deck-pink hover:border-deck-pink/50 transition-colors"
        >
          패널 닫기
        </button>
      </div>
    </div>
  );
}

export function Panel({ panel, spanClassName }: PanelProps) {
  const focusedId = usePanelStore((s) => s.focusedId);
  const setFocus = usePanelStore((s) => s.setFocus);
  const removePanel = usePanelStore((s) => s.removePanel);
  const updatePanel = usePanelStore((s) => s.updatePanel);
  const pinnedId = usePanelStore((s) => s.pinnedId);
  const setPinned = usePanelStore((s) => s.setPinned);
  const [confirming, setConfirming] = useState(false);

  function handleRegisterHook() {
    sendMessage({ type: "register-hook", panelId: panel.id });
  }

  function handleDismissHook() {
    updatePanel(panel.id, { hookConnected: null });
  }

  const isFocused = focusedId === panel.id;
  const isPinned = pinnedId === panel.id;
  const isActive = panel.status === "active" || panel.status === "idle" || panel.status === "input";
  const statusClasses = getStatusClasses(panel.status, isFocused);
  const statusIcon = getStatusIcon(panel.status, isFocused);
  const statusLabel = getStatusLabel(panel.status);

  function handleClose() {
    if (isActive) {
      setConfirming(true);
      return;
    }
    removePanel(panel.id);
  }

  function handleConfirmClose() {
    sendMessage({ type: "kill", panelId: panel.id });
    removePanel(panel.id);
    setConfirming(false);
  }

  function handlePinToggle() {
    setPinned(isPinned ? null : panel.id);
  }

  return (
    <div
      className={`flex flex-col rounded border bg-deck-panel overflow-hidden cursor-pointer transition-all duration-300 ${statusClasses} ${spanClassName}`}
      style={{ minHeight: 0 }}
      onClick={() => setFocus(panel.id)}
    >
      {/* 패널 헤더 — 확인 모드 */}
      {confirming ? (
        <div className="flex items-center justify-between px-3 py-2 border-b border-dotted border-deck-border shrink-0 bg-deck-bg/50">
          <div className="flex items-center gap-2">
            <span className="text-deck-pink text-xs animate-pulse">▪</span>
            <span className="text-deck-pink text-xs">세션 종료</span>
            <span className="text-deck-border text-xs tracking-[0.3em]">·····</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmClose();
              }}
              className="text-[10px] px-2 py-0.5 border border-dashed border-deck-pink text-deck-pink hover:bg-deck-pink/15 transition-colors"
            >
              종료
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(false);
              }}
              className="text-[10px] px-2 py-0.5 border border-dashed border-deck-border text-deck-dim hover:text-deck-text transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        /* 패널 헤더 — 기본 */
        <div
          className={`flex items-center justify-between px-3 py-2 border-b border-dotted border-deck-border shrink-0 ${
            isPinned ? "bg-deck-cyan/10" : "bg-deck-bg/50"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`${statusIcon.color} text-xs`}>{statusIcon.icon}</span>
            <span className="text-deck-text text-sm truncate">{panel.name}</span>

            {isPinned && <span className="text-deck-cyan text-[10px] tracking-wider">[ PIN ]</span>}

            {panel.status !== "setup" && (
              <>
                <span className="text-deck-dim text-xs tracking-[0.2em]">···</span>
                {statusLabel && (
                  <span className={`${statusLabel.color} text-xs`}>{statusLabel.text}</span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 입력 대기 뱃지 */}
            {panel.status === "input" && !isFocused && (
              <span
                className="text-deck-gold text-xs animate-badge inline-block"
                title="입력 대기중"
              >
                [ ! ]
              </span>
            )}

            {/* 훅 상태 표시 */}
            {panel.hookConnected === true && (
              <span className="text-xs" title="훅 연결됨">
                🔗
              </span>
            )}
            {panel.hookConnected === false && (
              <span
                className="text-xs cursor-pointer"
                title="훅 미연결 — 클릭하여 설정"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRegisterHook();
                }}
              >
                ⚠
              </span>
            )}

            {/* 핀 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePinToggle();
              }}
              className={`text-[10px] px-1.5 py-0.5 border transition-all ${
                isPinned
                  ? "bg-deck-cyan text-deck-bg font-bold border-deck-cyan shadow-[0_0_12px_#39C5BB]"
                  : "text-deck-dim border-dashed border-deck-border hover:text-deck-cyan hover:border-deck-cyan/50"
              }`}
              title={isPinned ? "핀 해제" : "핀 고정"}
            >
              PIN
            </button>

            {/* 닫기 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="text-deck-dim hover:text-deck-pink text-xs transition-colors"
              title="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 패널 본문 */}
      <div style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto" }} className="relative">
        {panel.status === "setup" ? (
          <PanelSetup panelId={panel.id} />
        ) : panel.status === "exited" ? (
          <ExitedView panel={panel} />
        ) : (
          <>
            {panel.hookConnected === false && (
              <div className="absolute inset-x-0 top-0 z-10 bg-deck-bg/95 border-b border-dashed border-deck-gold p-3 text-xs space-y-2">
                <div className="text-deck-gold">▪ 알림 훅 미등록</div>
                <div className="text-deck-dim">
                  Claude Code의 입력 대기 알림을 받으려면 훅 등록이 필요합니다
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRegisterHook();
                    }}
                    className="px-3 py-1 border border-deck-gold text-deck-gold hover:bg-deck-gold/15 transition-colors"
                  >
                    등록
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismissHook();
                    }}
                    className="px-3 py-1 border border-dashed border-deck-border text-deck-dim hover:text-deck-text transition-colors"
                  >
                    나중에
                  </button>
                </div>
              </div>
            )}
            <TerminalView panelId={panel.id} />
          </>
        )}
      </div>
    </div>
  );
}
