import { usePanelStore } from "../stores/panel-store";
import { useSettingsStore } from "../stores/settings-store";

const MAX_PANELS = 4;

export function Toolbar() {
  const aliveCount = usePanelStore((s) => s.panels.filter((p) => p.status !== "exited").length);
  const addPanel = usePanelStore((s) => s.addPanel);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const theme = useSettingsStore((s) => s.theme);
  const isMaxPanels = aliveCount >= MAX_PANELS;
  const isMiku = theme === "miku";

  return (
    <header className="flex items-center justify-between px-5 py-1.5 min-h-[52px] bg-deck-panel/80 backdrop-blur-sm border-b border-dotted border-deck-border relative z-40 shrink-0">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-2">
        {isMiku && <img src="/sprites/miku-idle.gif" alt="" className="miku-sprite h-10 shrink-0" />}
        <span className="text-deck-cyan text-xl tracking-wider font-bold">▪ DECK</span>
        {isMiku && <span className="text-deck-gold text-[10px] animate-sparkle opacity-60">✦</span>}
      </div>

      {/* 중앙: 장식 (miku 전용) */}
      {isMiku && (
        <div className="flex items-center gap-2">
          <span
            className="text-deck-pink text-[10px] animate-sparkle opacity-40"
            style={{ animationDelay: ".5s" }}
          >
            ♪
          </span>
          <span className="text-deck-dim text-xs tracking-[0.3em] hidden sm:inline">
            · · · · · · · · · · ·
          </span>
          <span
            className="text-deck-cyan text-[10px] animate-sparkle opacity-40"
            style={{ animationDelay: "1s" }}
          >
            ♫
          </span>
        </div>
      )}

      {/* 우측: 버튼 */}
      <div className="flex items-center gap-2">
        {isMiku && <img src="/sprites/miku-run.gif" alt="" className="miku-sprite h-9 shrink-0 opacity-80" />}
        <button
          onClick={() => addPanel()}
          disabled={isMaxPanels}
          className="border border-dashed border-deck-cyan text-deck-cyan px-3 py-1 text-sm hover:shadow-[0_0_12px_#39C5BB] transition-shadow cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none"
          title="새 패널 추가"
        >
          ＋
        </button>
        <button
          onClick={openSettings}
          className="border border-dashed border-deck-pink text-deck-pink px-3 py-1 text-sm hover:shadow-[0_0_12px_#FFB7C5] transition-shadow cursor-pointer"
          title="설정"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
