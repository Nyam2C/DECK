import { useState, useEffect } from "react";
import { useSettingsStore } from "../stores/settings-store";

type SettingsTab = "general" | "shortcuts" | "presets";

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [saved, setSaved] = useState(false);
  const closeSettings = useSettingsStore((s) => s.closeSettings);

  // ESC 키로 닫기
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeSettings();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeSettings]);

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "general", label: "▪ 일반" },
    { key: "shortcuts", label: "▪ 단축키" },
    { key: "presets", label: "▪ 프리셋" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSettings} />

      {/* 모달 */}
      <div className="relative bg-deck-panel pixel-border scanlines w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-deck-cyan/30 bg-deck-bg/60">
          <div className="flex items-center gap-2">
            <span className="text-deck-pink text-sm">⚙</span>
            <span className="text-deck-cyan text-sm font-bold">설정</span>
            <span className="text-deck-border text-xs tracking-[0.2em]">·················</span>
          </div>
          <button
            onClick={closeSettings}
            className="text-deck-pink hover:shadow-[0_0_8px_#FFB7C5] px-2 py-0.5 border border-dashed border-deck-pink/30 text-xs transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-deck-border bg-deck-bg/40 px-2 pt-2 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-xs border border-b-0 cursor-pointer transition-all -mb-px ${
                activeTab === tab.key
                  ? "border-deck-cyan/50 text-deck-cyan bg-deck-panel"
                  : "border-deck-border text-deck-dim bg-deck-bg/30 hover:text-deck-pink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 본문 */}
        <div className="flex-1 overflow-auto min-h-0 p-4">
          {activeTab === "general" && <GeneralTab />}
          {activeTab === "shortcuts" && <ShortcutsTab />}
          {activeTab === "presets" && <PresetsTab />}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-center gap-4 px-4 py-3 border-t-2 border-deck-cyan/20 bg-deck-bg/40">
          <button
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
            className="bg-deck-cyan text-deck-bg font-bold px-6 py-1.5 text-sm hover:shadow-[0_0_16px_#39C5BB] transition-shadow cursor-pointer tracking-wide"
          >
            {saved ? "\u2714 저장됨" : "\u25AA 저장"}
          </button>
          <button
            onClick={closeSettings}
            className="bg-deck-pink/15 text-deck-pink border border-dashed border-deck-pink/40 px-6 py-1.5 text-sm hover:shadow-[0_0_12px_#FFB7C5] transition-shadow cursor-pointer"
          >
            ▪ 닫기
          </button>
        </div>
      </div>
    </div>
  );
}

import type { ThemeId } from "../types";

const THEME_OPTIONS: { id: ThemeId; label: string; desc: string }[] = [
  { id: "miku", label: "Miku", desc: "사이버펑크 네온" },
  { id: "blue-dark", label: "Blue Dark", desc: "블루 다크" },
];

function GeneralTab() {
  const { fontSize, defaultPath, startBehavior, port, scrollback, theme, updateSettings } =
    useSettingsStore();
  const fontSizes = [12, 14, 16, 18, 20];

  return (
    <div className="space-y-4 text-xs">
      <div>
        <div className="text-deck-dim mb-2">▪ 테마</div>
        <div className="grid grid-cols-2 gap-1.5 pl-2">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => updateSettings({ theme: t.id })}
              className={`px-3 py-1.5 text-left cursor-pointer transition-all ${
                theme === t.id
                  ? "bg-deck-cyan/15 border border-deck-cyan/50 text-deck-cyan shadow-[0_0_6px_#39C5BB33]"
                  : "bg-deck-bg border border-dashed border-deck-border text-deck-dim hover:border-deck-cyan/50 hover:text-deck-text"
              }`}
            >
              <div>{t.label}</div>
              <div className="text-[10px] opacity-60">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-deck-dim mb-2">▪ 기본 글씨 크기</div>
        <div className="flex gap-1 pl-2">
          {fontSizes.map((size) => (
            <span
              key={size}
              onClick={() => updateSettings({ fontSize: size })}
              className={`px-2.5 py-1 cursor-pointer transition-colors ${
                fontSize === size
                  ? "bg-deck-cyan/15 border border-deck-cyan/50 text-deck-cyan shadow-[0_0_6px_#39C5BB33]"
                  : "bg-deck-bg border border-dashed border-deck-border text-deck-dim hover:border-deck-cyan/50 hover:text-deck-text"
              }`}
            >
              {size}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-deck-dim mb-2">▪ 기본 경로</div>
        <input
          type="text"
          value={defaultPath}
          onChange={(e) => updateSettings({ defaultPath: e.target.value })}
          placeholder="~/project"
          className="w-full bg-deck-bg border border-dashed border-deck-border px-2 py-1.5 text-deck-text font-term text-xs focus:border-deck-cyan/50 outline-none"
        />
        <div className="text-deck-dim text-[10px] mt-1 pl-1">
          새 패널의 경로 초기값 (비어있으면 ~/project)
        </div>
      </div>
      <div>
        <div className="text-deck-dim mb-2">▪ 시작 동작</div>
        <div className="flex gap-3 pl-2">
          {(["empty", "restore"] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
              <span
                className={`w-3 h-3 border flex items-center justify-center text-[8px] ${
                  startBehavior === opt
                    ? "border-deck-cyan text-deck-cyan"
                    : "border-deck-border text-transparent"
                }`}
              >
                ■
              </span>
              <span
                className={
                  startBehavior === opt ? "text-deck-cyan" : "text-deck-dim hover:text-deck-text"
                }
                onClick={() => updateSettings({ startBehavior: opt })}
              >
                {opt === "empty" ? "빈 상태로 시작" : "이전 상태 복원"}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="text-deck-dim mb-2">▪ 포트 번호</div>
        <input
          type="number"
          value={port}
          min={1024}
          max={65535}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= 1024 && v <= 65535) updateSettings({ port: v });
          }}
          className="w-28 bg-deck-bg border border-dashed border-deck-border px-2 py-1.5 text-deck-text font-term text-xs focus:border-deck-cyan/50 outline-none"
        />
        <div className="text-deck-dim text-[10px] mt-1 pl-1">서버 포트 (1024–65535)</div>
      </div>
      <div>
        <div className="text-deck-dim mb-2">▪ 스크롤백 버퍼</div>
        <input
          type="number"
          value={scrollback}
          min={1000}
          max={50000}
          step={1000}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= 1000 && v <= 50000) updateSettings({ scrollback: v });
          }}
          className="w-28 bg-deck-bg border border-dashed border-deck-border px-2 py-1.5 text-deck-text font-term text-xs focus:border-deck-cyan/50 outline-none"
        />
        <div className="text-deck-dim text-[10px] mt-1 pl-1">
          터미널 스크롤백 줄 수 (1000–50000)
        </div>
      </div>
      <div className="text-deck-border text-center tracking-[0.3em] text-[10px]">
        · · · · · · · · · · · · · · · · · · ·
      </div>
    </div>
  );
}

function ShortcutsTab() {
  const shortcuts = [
    { label: "패널 포커스 전환", keys: ["Ctrl", "Space", "→", "1~4"] },
    { label: "새 패널 추가", keys: ["Ctrl", "Space", "→", "N"] },
    { label: "패널 닫기", keys: ["Ctrl", "Space", "→", "W"] },
    { label: "설정 열기", keys: ["Ctrl", "Space", "→", "S"] },
  ];

  return (
    <div className="space-y-3 text-xs">
      <div className="text-deck-dim mb-1">▪ 키보드 단축키 (Leader Key 방식)</div>
      <div className="space-y-2 pl-1">
        {shortcuts.map((sc, i) => (
          <div key={i}>
            <div className="flex items-center justify-between py-1">
              <span className="text-deck-text">{sc.label}</span>
              <div className="flex gap-1">
                {sc.keys.map((key, j) =>
                  key === "→" ? (
                    <span key={j} className="text-deck-dim">
                      →
                    </span>
                  ) : (
                    <span
                      key={j}
                      className="px-2 py-0.5 bg-deck-bg border border-deck-border text-deck-cyan font-term text-[10px]"
                    >
                      {key}
                    </span>
                  ),
                )}
              </div>
            </div>
            {i < shortcuts.length - 1 && (
              <div className="border-b border-dotted border-deck-border" />
            )}
          </div>
        ))}
      </div>
      <div className="text-center text-deck-dim text-[10px] mt-3 leading-relaxed">
        Leader Key 입력 후 500ms 내 두 번째 키 입력
      </div>
    </div>
  );
}

function PresetsTab() {
  return (
    <div className="space-y-3 text-xs">
      <div className="text-deck-dim mb-1">▪ 프리셋 관리</div>
      <div className="border border-dashed border-deck-border bg-deck-bg">
        <div className="text-deck-dim text-center py-4">저장된 프리셋이 없습니다</div>
      </div>
      <div className="border border-dashed border-deck-cyan/30 text-deck-cyan/60 text-center py-2 cursor-pointer hover:bg-deck-cyan/5 hover:border-deck-cyan/50 hover:text-deck-cyan transition-all">
        ＋ 현재 상태를 프리셋으로 저장
      </div>
      <div className="text-center text-deck-dim text-[10px] mt-2 leading-relaxed">
        자주 쓰는 패널 조합을
        <br />
        <span className="text-deck-cyan">프리셋</span>으로 저장해 보세요
      </div>
    </div>
  );
}
