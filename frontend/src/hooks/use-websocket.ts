import { create } from "zustand";

// ═══════════════════════ 메시지 타입 (백엔드 types.ts 동기화) ═══════════════════════

export type ClientMessage =
  | { type: "create"; cli: string; path: string; options: string; panelId?: string }
  | { type: "input"; panelId: string; data: string }
  | { type: "resize"; panelId: string; cols: number; rows: number }
  | { type: "kill"; panelId: string }
  | { type: "autocomplete"; panelId: string; partial: string }
  | { type: "register-hook"; panelId: string };

export type PanelState = "active" | "idle" | "input";

export type ServerMessage =
  | { type: "created"; panelId: string }
  | { type: "output"; panelId: string; data: string }
  | { type: "exited"; panelId: string; exitCode: number }
  | { type: "autocomplete-result"; panelId: string; candidates: string[] }
  | { type: "status"; panelId: string; state: PanelState }
  | { type: "error"; panelId: string; message: string }
  | { type: "hook-notify"; panelId: string; message: string }
  | { type: "hook-status"; panelId: string; connected: boolean };

// ═══════════════════════ 연결 상태 스토어 ═══════════════════════

type ConnectionState = "connecting" | "connected" | "disconnected" | "replaced";

interface WsState {
  connectionState: ConnectionState;
  /** 한 번이라도 연결된 적 있는지 (초기 로드 vs 연결 끊김 구분용) */
  wasConnected: boolean;
}

export const useWsState = create<WsState>(() => ({
  connectionState: "disconnected",
  wasConnected: false,
}));

// ═══════════════════════ 메시지 핸들러 레지스트리 ═══════════════════════

type MessageHandler = (msg: ServerMessage) => void;

const handlers = new Set<MessageHandler>();

/** 서버 메시지 핸들러 등록. 해제 함수를 반환한다. */
export function onServerMessage(handler: MessageHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

function dispatch(msg: ServerMessage): void {
  for (const handler of handlers) {
    handler(msg);
  }
}

// ═══════════════════════ 싱글톤 WebSocket ═══════════════════════

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectCount = 0;
const MAX_RECONNECT = 10;
const RECONNECT_DELAY = 2000;
let shouldConnect = false;

function getWsUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

export function connectWebSocket(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  shouldConnect = true;
  useWsState.setState({ connectionState: "connecting" });

  const socket = new WebSocket(getWsUrl());
  ws = socket;

  socket.onopen = () => {
    if (ws !== socket) return;
    reconnectCount = 0;
    useWsState.setState({ connectionState: "connected", wasConnected: true });
  };

  socket.onmessage = (event) => {
    if (ws !== socket) return;
    try {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      dispatch(msg);
    } catch {
      // 파싱 실패한 메시지 무시
    }
  };

  socket.onclose = (event) => {
    // 이미 새 연결로 교체된 경우 — 이 소켓의 이벤트는 무시
    if (ws !== socket) return;

    ws = null;

    // 다른 탭에서 연결되어 교체된 경우 — 재연결하지 않음
    if (event.reason === "새 연결로 교체") {
      shouldConnect = false;
      useWsState.setState({ connectionState: "replaced" });
      return;
    }

    useWsState.setState({ connectionState: "disconnected" });

    if (shouldConnect && reconnectCount < MAX_RECONNECT) {
      reconnectCount++;
      reconnectTimer = setTimeout(connectWebSocket, RECONNECT_DELAY);
    }
  };

  socket.onerror = () => {
    // onclose에서 재연결 처리
  };
}

export function disconnectWebSocket(): void {
  shouldConnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  useWsState.setState({ connectionState: "disconnected" });
}

/** 메시지 전송. 성공 시 true, 미연결 시 false 반환. */
export function sendMessage(msg: ClientMessage): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[DECK] WebSocket 미연결 — 메시지 전송 불가:", msg.type);
    return false;
  }
  ws.send(JSON.stringify(msg));
  return true;
}

// ═══════════════════════ React 훅 ═══════════════════════

import { useEffect } from "react";

/** App 최상위에서 1회 호출. 마운트 시 연결, 언마운트 시 해제. */
export function useWebSocketInit(): void {
  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, []);
}
