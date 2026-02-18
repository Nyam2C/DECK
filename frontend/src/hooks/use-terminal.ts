import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

import { sendMessage, onServerMessage } from "./use-websocket";
import { useSettingsStore } from "../stores/settings-store";

interface UseTerminalOptions {
  panelId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useTerminal({ panelId, containerRef }: UseTerminalOptions): void {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const scrollback = useSettingsStore((s) => s.scrollback);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Terminal 인스턴스 생성
    const terminal = new Terminal({
      fontSize,
      scrollback,
      cursorBlink: true,
      theme: {
        background: "#12121f",
        foreground: "#e0e0e8",
        cursor: "#39c5bb",
        selectionBackground: "#39c5bb55",
      },
    });
    termRef.current = terminal;

    // 2. FitAddon 로드 + 마운트
    const fitAddon = new FitAddon();
    fitRef.current = fitAddon;
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    // 3. WebGL 렌더러 시도 (실패 시 캔버스 폴백)
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      terminal.loadAddon(webglAddon);
    } catch {
      // 캔버스 렌더러로 폴백 (기본)
    }

    // 4. 키 입력 → WebSocket
    const onDataDisposable = terminal.onData((data) => {
      sendMessage({ type: "input", panelId, data });
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
      onDataDisposable.dispose();
      unsubscribe();
      terminal.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [panelId, containerRef, fontSize, scrollback]);
}
