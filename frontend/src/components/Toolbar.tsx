import { useState, useEffect, useRef, useCallback } from "react";
import { usePanelStore } from "../stores/panel-store";
import { useSettingsStore } from "../stores/settings-store";
import { formatElapsed } from "../services/stopwatch";

const MAX_PANELS = 4;
const STORAGE_KEY = "deck-stopwatch";

interface StopwatchState {
  elapsed: number;
  running: boolean;
  lastTick: number;
}

export function loadStopwatch(): StopwatchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { elapsed: 0, running: false, lastTick: 0 };
    const parsed = JSON.parse(raw) as StopwatchState;
    // running이었으면 경과 시간 보정
    if (parsed.running && parsed.lastTick > 0) {
      parsed.elapsed += Date.now() - parsed.lastTick;
      parsed.lastTick = Date.now();
    }
    return parsed;
  } catch {
    return { elapsed: 0, running: false, lastTick: 0 };
  }
}

export function saveStopwatch(state: StopwatchState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function Toolbar() {
  const aliveCount = usePanelStore((s) => s.panels.filter((p) => p.status !== "exited").length);
  const addPanel = usePanelStore((s) => s.addPanel);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const theme = useSettingsStore((s) => s.theme);
  const isMaxPanels = aliveCount >= MAX_PANELS;
  const isMiku = theme === "miku";

  // 스톱워치 상태
  const [swOpen, setSwOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const lastTickRef = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 마운트 시 localStorage에서 복원
  useEffect(() => {
    const saved = loadStopwatch();
    setElapsed(saved.elapsed);
    setRunning(saved.running);
    lastTickRef.current = saved.running ? Date.now() : 0;
  }, []);

  // running 중 매초 갱신
  useEffect(() => {
    if (!running) return;
    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setElapsed((prev) => {
        const next = prev + delta;
        saveStopwatch({ elapsed: next, running: true, lastTick: now });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!swOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSwOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [swOpen]);

  const handleStart = useCallback(() => {
    const now = Date.now();
    lastTickRef.current = now;
    setRunning(true);
    saveStopwatch({ elapsed, running: true, lastTick: now });
  }, [elapsed]);

  const handleStop = useCallback(() => {
    setRunning(false);
    saveStopwatch({ elapsed, running: false, lastTick: 0 });
  }, [elapsed]);

  const handleReset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    lastTickRef.current = 0;
    saveStopwatch({ elapsed: 0, running: false, lastTick: 0 });
  }, []);

  return (
    <header className="flex items-center justify-between px-5 py-1.5 min-h-[52px] bg-deck-panel/80 backdrop-blur-sm border-b border-dotted border-deck-border relative z-40 shrink-0">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-2">
        {isMiku && (
          <img src="/sprites/miku-idle.gif" alt="" className="miku-sprite h-10 shrink-0" />
        )}
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

      {/* 우측: 버튼 (＋ · ⏱ · ⚙) */}
      <div className="flex items-center gap-2">
        {isMiku && (
          <img src="/sprites/miku-run.gif" alt="" className="miku-sprite h-9 shrink-0 opacity-80" />
        )}
        <button
          onClick={() => addPanel()}
          disabled={isMaxPanels}
          className="border border-dashed border-deck-cyan text-deck-cyan px-3 py-1 text-sm hover:shadow-[0_0_12px_#39C5BB] transition-shadow cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none"
          title="새 패널 추가"
          aria-label="새 패널 추가"
        >
          ＋
        </button>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setSwOpen(!swOpen)}
            className={`border border-dashed border-deck-cyan text-deck-cyan px-3 py-1 text-sm transition-shadow cursor-pointer ${
              running ? "shadow-[0_0_12px_#39C5BB]" : "hover:shadow-[0_0_12px_#39C5BB]"
            }`}
            title="스톱워치"
            aria-label="스톱워치"
          >
            ⏱
          </button>
          {swOpen && (
            <div className="absolute right-0 top-full mt-1 bg-deck-panel border border-deck-border p-4 z-50 min-w-[200px]">
              <div className="font-term text-deck-cyan text-3xl tracking-widest text-center mb-3">
                {formatElapsed(elapsed)}
              </div>
              <div className="flex gap-2 justify-center">
                {running ? (
                  <button
                    onClick={handleStop}
                    className="px-3 py-1 text-xs border border-dashed border-deck-cyan text-deck-cyan hover:bg-deck-cyan/15 transition-colors cursor-pointer"
                  >
                    ⏸ 정지
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    className="px-3 py-1 text-xs border border-dashed border-deck-cyan text-deck-cyan hover:bg-deck-cyan/15 transition-colors cursor-pointer"
                  >
                    ▶ 시작
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="px-3 py-1 text-xs border border-dashed border-deck-border text-deck-dim hover:text-deck-pink hover:border-deck-pink/50 transition-colors cursor-pointer"
                >
                  ↺ 리셋
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={openSettings}
          className="border border-dashed border-deck-pink text-deck-pink px-3 py-1 text-sm hover:shadow-[0_0_12px_#FFB7C5] transition-shadow cursor-pointer"
          title="설정"
          aria-label="설정"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
