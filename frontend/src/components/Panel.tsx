import { usePanelStore } from "../stores/panel-store";
import { PanelSetup } from "./PanelSetup";
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

export function Panel({ panel, spanClassName }: PanelProps) {
  const focusedId = usePanelStore((s) => s.focusedId);
  const setFocus = usePanelStore((s) => s.setFocus);
  const removePanel = usePanelStore((s) => s.removePanel);
  const pinnedId = usePanelStore((s) => s.pinnedId);
  const setPinned = usePanelStore((s) => s.setPinned);

  const isFocused = focusedId === panel.id;
  const isPinned = pinnedId === panel.id;
  const statusClasses = getStatusClasses(panel.status, isFocused);
  const statusIcon = getStatusIcon(panel.status, isFocused);
  const statusLabel = getStatusLabel(panel.status);

  function handleClose() {
    // 활성 세션은 확인 다이얼로그 (Phase 4에서 PTY kill 연동)
    if (panel.status === "active" || panel.status === "input") {
      if (!confirm("활성 세션이 종료됩니다. 계속하시겠습니까?")) return;
    }
    removePanel(panel.id);
  }

  function handlePinToggle() {
    setPinned(isPinned ? null : panel.id);
  }

  return (
    <div
      className={`flex flex-col rounded border bg-deck-panel overflow-hidden cursor-pointer transition-all duration-300 ${statusClasses} ${spanClassName}`}
      onClick={() => setFocus(panel.id)}
    >
      {/* 패널 헤더 */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-dotted border-deck-border ${
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
          {panel.status === "input" && (
            <span className="text-deck-gold text-xs animate-badge inline-block" title="입력 대기중">
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
            <span className="text-xs cursor-pointer" title="훅 미연결 — 클릭하여 설정">
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

      {/* 패널 본문 */}
      <div className="flex-1 overflow-auto min-h-0">
        {panel.status === "setup" ? (
          <PanelSetup panelId={panel.id} />
        ) : (
          // Phase 4에서 터미널 div로 교체
          <div className="p-3 font-term text-xs leading-relaxed">
            <span className="text-deck-dim">터미널 연결 대기중...</span>
          </div>
        )}
      </div>
    </div>
  );
}
