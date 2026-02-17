import type { ServerWebSocket } from "bun";
import { handleMessage } from "./message-handler";
import { PtyManager } from "./pty-manager";
import type { ServerMessage } from "./types";

export interface DeckServerOptions {
  port: number;
  hostname: string;
  staticDir: string;
}

export function createServer(options: DeckServerOptions) {
  const { port, hostname, staticDir } = options;

  // WebSocket → ServerMessage 전송 함수
  function send(ws: ServerWebSocket<unknown>, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }

  // PTY 매니저 생성 — onData/onExit 시 연결된 WebSocket에 메시지 전송
  let activeWs: ServerWebSocket<unknown> | null = null;

  const ptyManager = new PtyManager(
    // onData: PTY 출력 → WebSocket 전달
    (panelId, data) => {
      if (activeWs) {
        send(activeWs, { type: "output", panelId, data });
      }
    },
    // onExit: PTY 종료 → WebSocket 알림
    (panelId, exitCode) => {
      if (activeWs) {
        send(activeWs, { type: "exited", panelId, exitCode });
      }
    },
  );

  const server = Bun.serve({
    port,
    hostname,

    fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket 업그레이드
      if (url.pathname === "/ws") {
        // 다중 탭 방지: 이미 연결된 WebSocket이 있으면 거부
        if (activeWs) {
          return new Response("이미 사용 중인 연결이 있습니다", { status: 409 });
        }
        const success = server.upgrade(req);
        if (success) return undefined;
        return new Response("WebSocket 업그레이드 실패", { status: 400 });
      }

      // 훅 엔드포인트 (Claude Code Notification 훅)
      if (url.pathname === "/hook/notify" && req.method === "POST") {
        return handleHookNotify(req);
      }

      // 정적 파일 서빙 (frontend/dist)
      return serveStatic(url.pathname, staticDir);
    },

    websocket: {
      open(ws) {
        activeWs = ws;
      },

      message(ws, raw) {
        const data = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        handleMessage(data, ptyManager, (msg) => send(ws, msg));
      },

      close() {
        activeWs = null;
        // WebSocket 끊김 시 모든 PTY 종료하지 않음
        // (브라우저 새로고침 시 재연결 가능하도록)
      },
    },
  });

  async function handleHookNotify(req: Request): Promise<Response> {
    try {
      const body = await req.json();
      const { panelId, message } = body;
      if (activeWs && panelId && message) {
        send(activeWs, { type: "hook-notify", panelId, message });
      }
      return new Response("OK", { status: 200 });
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
  }

  return { server, ptyManager };
}

/** 정적 파일 서빙 */
async function serveStatic(pathname: string, staticDir: string): Promise<Response> {
  const filePath = pathname === "/" ? "/index.html" : pathname;
  const file = Bun.file(`${staticDir}${filePath}`);

  if (await file.exists()) {
    return new Response(file);
  }

  // SPA 폴백: 모든 경로에 index.html 반환
  const index = Bun.file(`${staticDir}/index.html`);
  if (await index.exists()) {
    return new Response(index);
  }

  return new Response("Not Found", { status: 404 });
}
