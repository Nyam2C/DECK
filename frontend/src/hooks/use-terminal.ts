import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

import { sendMessage, onServerMessage } from "./use-websocket";
import { isLeaderKey } from "./use-keyboard";
import { useSettingsStore } from "../stores/settings-store";
import type { ThemeId } from "../types";
import type { ITheme } from "@xterm/xterm";

const TERMINAL_THEMES: Record<ThemeId, ITheme> = {
  miku: {
    background: "#12121f",
    foreground: "#e0e0e8",
    cursor: "#39c5bb",
    selectionBackground: "#39c5bb55",
  },
  "blue-dark": {
    background: "#1a1a1a",
    foreground: "#c0caf5",
    cursor: "#7aa2f7",
    selectionBackground: "#7aa2f755",
  },
};

interface UseTerminalOptions {
  panelId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useTerminal({ panelId, containerRef }: UseTerminalOptions): void {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const scrollback = useSettingsStore((s) => s.scrollback);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Terminal 인스턴스 생성
    const terminal = new Terminal({
      fontSize,
      scrollback,
      cursorBlink: true,
      theme: TERMINAL_THEMES[theme] ?? TERMINAL_THEMES.miku,
    });
    termRef.current = terminal;

    // 2. FitAddon 로드 + 마운트
    const fitAddon = new FitAddon();
    fitRef.current = fitAddon;
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    // 키 이벤트 가로채기
    terminal.attachCustomKeyEventHandler((domEvent) => {
      // Leader Key
      if (isLeaderKey(domEvent, useSettingsStore.getState().leaderKey)) return false;

      if (domEvent.type !== "keydown") return true;

      // Ctrl+C: 선택 텍스트가 있으면 복사, 없으면 ^C 전달
      if (domEvent.ctrlKey && domEvent.key === "c") {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          terminal.clearSelection();
          return false;
        }
        return true;
      }

      // Ctrl+V: 클립보드에서 붙여넣기 (preventDefault로 브라우저 paste 이벤트 차단)
      if (domEvent.ctrlKey && domEvent.key === "v") {
        domEvent.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (text) sendMessage({ type: "input", panelId, data: text });
        });
        return false;
      }

      return true;
    });

    fitAddon.fit();

    // 3. WebGL 렌더러 시도 (실패 시 캔버스 폴백)
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      terminal.loadAddon(webglAddon);
    } catch {
      // 캔버스 렌더러로 폴백 (기본)
    }

    // 4. 키 입력 → WebSocket (배치 버퍼: 짧은 간격 내 연속 입력을 하나로 묶어 전송)
    let inputBuf = "";
    let inputTimer: ReturnType<typeof setTimeout> | null = null;
    const INPUT_BATCH_MS = 6;

    const flushInput = () => {
      if (inputBuf) {
        sendMessage({ type: "input", panelId, data: inputBuf });
        inputBuf = "";
      }
      inputTimer = null;
    };

    const onDataDisposable = terminal.onData((data) => {
      inputBuf += data;
      if (!inputTimer) {
        inputTimer = setTimeout(flushInput, INPUT_BATCH_MS);
      }
    });

    // 5. 서버 메시지 구독 → 터미널 출력
    const unsubscribe = onServerMessage((msg) => {
      if (msg.type === "output" && msg.panelId === panelId) {
        terminal.write(msg.data);
      }
    });

    // 6. ResizeObserver → fit → resize 메시지
    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!fitRef.current || !termRef.current) return;
        fitRef.current.fit();
        const { cols, rows } = termRef.current;
        sendMessage({ type: "resize", panelId, cols, rows });
      });
    });
    resizeObserver.observe(container);

    // 7. 정리
    return () => {
      resizeObserver.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (inputTimer) {
        clearTimeout(inputTimer);
        flushInput();
      }
      onDataDisposable.dispose();
      unsubscribe();
      terminal.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [panelId, containerRef, fontSize, scrollback]);

  // 테마 변경 시 터미널 재생성 없이 옵션만 업데이트
  useEffect(() => {
    const terminal = termRef.current;
    if (!terminal) return;
    terminal.options.theme = TERMINAL_THEMES[theme] ?? TERMINAL_THEMES.miku;
  }, [theme]);
}
