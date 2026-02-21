import { useState, useEffect, useRef, useCallback } from "react";
import { usePanelStore } from "../stores/panel-store";
import { useSettingsStore } from "../stores/settings-store";
import { formatElapsed } from "../services/stopwatch";

const MAX_PANELS = 4;
const STORAGE_KEY = "deck-stopwatch";

interface UsageLimits {
  plan: string;
  fiveHour: { utilization: number; resetsAt: string };
  sevenDay: { utilization: number; resetsAt: string };
  sevenDayOpus?: { utilization: number; resetsAt: string } | null;
  sevenDaySonnet?: { utilization: number; resetsAt: string } | null;
}

interface UsageSummary {
  date: string;
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreateTokens: number;
  totalCacheReadTokens: number;
  byModel: Record<string, { costUSD: number; inputTokens: number; outputTokens: number }>;
  limits: UsageLimits | null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatResetTime(resetsAt: string): string {
  if (!resetsAt) return "";
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return "soon";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return `${days}d ${remH}h`;
  }
  return `${hours}h ${minutes}m`;
}

function utilizationColor(util: number): string {
  if (util >= 80) return "bg-deck-pink";
  if (util >= 50) return "bg-yellow-400";
  return "bg-deck-cyan";
}

function utilizationBorderColor(util: number): string {
  if (util >= 80) return "border-deck-pink text-deck-pink";
  if (util >= 50) return "border-yellow-400 text-yellow-400";
  return "border-deck-cyan text-deck-cyan";
}

function GaugeBar({ utilization }: { utilization: number }) {
  return (
    <div className="w-full h-2 bg-deck-border rounded-sm overflow-hidden">
      <div
        className={`h-full ${utilizationColor(utilization)} transition-all`}
        style={{ width: `${Math.min(utilization, 100)}%` }}
      />
    </div>
  );
}

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

  // 사용량 상태
  const [usageOpen, setUsageOpen] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const usageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage");
        if (!cancelled && res.ok) setUsage(await res.json());
      } catch {
        // 무시
      }
    }
    fetchUsage();
    const interval = setInterval(fetchUsage, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!usageOpen) return;
    function handleClick(e: MouseEvent) {
      if (usageRef.current && !usageRef.current.contains(e.target as Node)) {
        setUsageOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [usageOpen]);

  return (
    <header className="flex items-center justify-between px-5 py-1.5 min-h-[52px] bg-deck-panel/80 backdrop-blur-sm border-b border-dotted border-deck-border relative z-40 shrink-0 [-webkit-app-region:drag]">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-2">
        {isMiku && (
          <img src="/sprites/miku-idle.gif" alt="" className="miku-sprite h-10 shrink-0" />
        )}
        <span className="text-deck-cyan text-xl tracking-wider font-bold">▪ DECK</span>
        {isMiku && <span className="text-deck-gold text-[10px] animate-sparkle opacity-60">✦</span>}
      </div>

      {/* 중앙: 장식 (miku 전용) — absolute로 정중앙 배치 */}
      {isMiku && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
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

      {/* 우측: 버튼 (＋ · ◷ · ⚙) */}
      <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
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
            ◷
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
                    ■ 정지
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
        <div className="relative" ref={usageRef}>
          {(() => {
            const limits = usage?.limits;
            const maxUtil = limits
              ? Math.max(limits.fiveHour.utilization, limits.sevenDay.utilization)
              : 0;
            const noData = usage && !limits && usage.totalInputTokens === 0;
            const btnColor = noData
              ? "border-deck-border text-deck-dim"
              : limits
                ? utilizationBorderColor(maxUtil)
                : "border-deck-cyan text-deck-cyan";
            const btnText = "⦿";

            return (
              <button
                onClick={() => setUsageOpen(!usageOpen)}
                className={`border border-dashed ${btnColor} px-3 py-1 text-sm hover:shadow-[0_0_12px_#39C5BB] transition-shadow cursor-pointer`}
                title="Claude 사용량"
                aria-label="Claude 사용량"
              >
                {btnText}
              </button>
            );
          })()}
          {usageOpen && usage && (
            <div className="absolute right-0 top-full mt-1 bg-deck-panel border border-deck-border p-4 z-50 min-w-[220px] font-term text-sm">
              {!usage.limits && usage.totalInputTokens === 0 ? (
                <div className="text-deck-dim text-xs text-center py-2">
                  Claude Code 미감지
                </div>
              ) : usage.limits ? (
                <>
                  <div className="text-deck-text font-bold mb-2">{usage.limits.plan}</div>
                  <div className="border-t border-deck-border my-2" />

                  {/* 5시간 세션 */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-deck-dim">세션 (5h)</span>
                      <span className="text-deck-text">{Math.round(usage.limits.fiveHour.utilization)}%</span>
                    </div>
                    <GaugeBar utilization={usage.limits.fiveHour.utilization} />
                    {usage.limits.fiveHour.resetsAt && (
                      <div className="text-[10px] text-deck-dim mt-0.5">리셋: {formatResetTime(usage.limits.fiveHour.resetsAt)}</div>
                    )}
                  </div>

                  {/* 7일 주간 */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-deck-dim">주간 (7d)</span>
                      <span className="text-deck-text">{Math.round(usage.limits.sevenDay.utilization)}%</span>
                    </div>
                    <GaugeBar utilization={usage.limits.sevenDay.utilization} />
                    {usage.limits.sevenDay.resetsAt && (
                      <div className="text-[10px] text-deck-dim mt-0.5">리셋: {formatResetTime(usage.limits.sevenDay.resetsAt)}</div>
                    )}
                  </div>

                  {/* Opus (7d) — 있을 때만 */}
                  {usage.limits.sevenDayOpus && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-deck-dim">Opus (7d)</span>
                        <span className="text-deck-text">{Math.round(usage.limits.sevenDayOpus.utilization)}%</span>
                      </div>
                      <GaugeBar utilization={usage.limits.sevenDayOpus.utilization} />
                    </div>
                  )}

                  {/* Sonnet (7d) — 있을 때만 */}
                  {usage.limits.sevenDaySonnet && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-deck-dim">Sonnet (7d)</span>
                        <span className="text-deck-text">{Math.round(usage.limits.sevenDaySonnet.utilization)}%</span>
                      </div>
                      <GaugeBar utilization={usage.limits.sevenDaySonnet.utilization} />
                    </div>
                  )}

                  <div className="border-t border-deck-border my-2" />
                  {/* 비용 섹션 */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-deck-dim">오늘 비용</span>
                      <span className="text-deck-cyan">${usage.totalCostUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-deck-dim">Input</span>
                      <span className="text-deck-text">{formatTokens(usage.totalInputTokens)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-deck-dim">Output</span>
                      <span className="text-deck-text">{formatTokens(usage.totalOutputTokens)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-deck-dim mb-2">오늘의 사용량</div>
                  <div className="border-t border-deck-border my-2" />
                  {/* 비용 섹션 */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-deck-dim">오늘 비용</span>
                      <span className="text-deck-cyan">${usage.totalCostUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-deck-dim">Input</span>
                      <span className="text-deck-text">{formatTokens(usage.totalInputTokens)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-deck-dim">Output</span>
                      <span className="text-deck-text">{formatTokens(usage.totalOutputTokens)}</span>
                    </div>
                  </div>
                  {Object.keys(usage.byModel).length > 0 && (
                    <>
                      <div className="border-t border-deck-border my-2" />
                      <div className="text-deck-dim mb-1 text-xs">모델별</div>
                      <div className="space-y-1 text-xs">
                        {Object.entries(usage.byModel).map(([model, data]) => (
                          <div key={model} className="flex justify-between">
                            <span className="text-deck-text">{model}</span>
                            <span className="text-deck-cyan">${data.costUSD.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
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
        {/* 창 컨트롤 (Electron) */}
        {"electronAPI" in window && (
          <div className="flex items-center ml-2 border-l border-deck-border pl-2">
            <button
              onClick={() => (window as any).electronAPI.minimize()}
              className="text-deck-dim hover:text-deck-cyan px-2 py-1 text-xs transition-colors cursor-pointer"
              aria-label="최소화"
            >
              ─
            </button>
            <button
              onClick={() => (window as any).electronAPI.maximize()}
              className="text-deck-dim hover:text-deck-cyan px-2 py-1 text-xs transition-colors cursor-pointer"
              aria-label="최대화"
            >
              □
            </button>
            <button
              onClick={() => (window as any).electronAPI.close()}
              className="text-deck-dim hover:text-deck-pink px-2 py-1 text-xs transition-colors cursor-pointer"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
