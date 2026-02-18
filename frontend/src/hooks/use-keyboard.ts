import { useEffect, useRef, useState } from "react";
import { usePanelStore } from "../stores/panel-store";
import { useSettingsStore } from "../stores/settings-store";

/** leaderKey 설정 문자열을 KeyboardEvent와 비교 */
export function isLeaderKey(e: KeyboardEvent, leaderKey: string): boolean {
  const parts = leaderKey.toLowerCase().split("+");
  const key = parts.pop();
  const mods = new Set(parts);

  if (mods.has("ctrl") !== e.ctrlKey) return false;
  if (mods.has("shift") !== e.shiftKey) return false;
  if (mods.has("alt") !== e.altKey) return false;
  if (mods.has("meta") !== e.metaKey) return false;

  return e.key.toLowerCase() === key || e.code.toLowerCase() === key;
}

type LeaderState = "idle" | "waiting";

export function useKeyboard(): { leaderActive: boolean } {
  const [leaderActive, setLeaderActive] = useState(false);
  const stateRef = useRef<LeaderState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const leaderKey = useSettingsStore.getState().leaderKey;

      if (stateRef.current === "idle") {
        if (isLeaderKey(e, leaderKey)) {
          e.preventDefault();
          e.stopPropagation();
          stateRef.current = "waiting";
          setLeaderActive(true);
          timerRef.current = setTimeout(() => {
            stateRef.current = "idle";
            setLeaderActive(false);
            timerRef.current = null;
          }, 500);
        }
        return;
      }

      // waiting 상태 — 명령키 처리
      e.preventDefault();
      e.stopPropagation();

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      stateRef.current = "idle";
      setLeaderActive(false);

      const { panels, setFocus } = usePanelStore.getState();
      const key = e.key.toLowerCase();

      // 1~4: 패널 포커스
      if (key >= "1" && key <= "4") {
        const idx = Number.parseInt(key) - 1;
        const target = panels[idx];
        if (target) setFocus(target.id);
        return;
      }

      switch (key) {
        case "n": {
          // 새 패널
          usePanelStore.getState().addPanel();
          break;
        }
        case "w": {
          // 포커스된 패널 닫기
          document.dispatchEvent(new CustomEvent("deck:close-panel"));
          break;
        }
        case "s": {
          // 설정 토글
          const settings = useSettingsStore.getState();
          if (settings.isOpen) settings.closeSettings();
          else settings.openSettings();
          break;
        }
      }
    }

    document.addEventListener("keydown", handler, { capture: true });
    return () => {
      document.removeEventListener("keydown", handler, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { leaderActive };
}
