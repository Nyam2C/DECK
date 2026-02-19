import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { handleMessage } from "./message-handler";
import { PtyManager } from "./pty-manager";
import type { ServerMessage, Preset } from "./types";
import {
  loadPresets,
  savePreset,
  deletePreset,
  updatePreset,
  loadSession,
  saveSession,
} from "./session-manager";

export interface DeckServerOptions {
  port: number;
  hostname: string;
  staticDir: string;
  preset?: string;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function createServer(options: DeckServerOptions) {
  const { port, hostname, staticDir, preset: presetName } = options;

  let activeWs: WebSocket | null = null;

  function send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  const ptyManager = new PtyManager(
    (panelId, data) => {
      if (activeWs) send(activeWs, { type: "output", panelId, data });
    },
    (panelId, exitCode) => {
      if (activeWs) send(activeWs, { type: "exited", panelId, exitCode });
      saveSession(ptyManager.getActivePanels());
    },
  );

  // HTTP 서버
  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    // 훅 엔드포인트
    if (url.pathname === "/hook/notify" && req.method === "POST") {
      await handleHookNotify(req, res);
      return;
    }

    // ─── 프리셋 API ───
    if (url.pathname === "/api/presets" && req.method === "GET") {
      const presets = await loadPresets();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(presets));
      return;
    }
    if (url.pathname === "/api/presets" && req.method === "POST") {
      const body = await readBody(req);
      try {
        const preset = JSON.parse(body) as Preset;
        await savePreset(preset);
        res.writeHead(200).end("OK");
      } catch {
        res.writeHead(400).end("Bad Request");
      }
      return;
    }
    if (url.pathname.startsWith("/api/presets/") && req.method === "DELETE") {
      const name = decodeURIComponent(url.pathname.slice("/api/presets/".length));
      await deletePreset(name);
      res.writeHead(200).end("OK");
      return;
    }
    if (url.pathname.startsWith("/api/presets/") && req.method === "PUT") {
      const originalName = decodeURIComponent(url.pathname.slice("/api/presets/".length));
      const body = await readBody(req);
      try {
        const preset = JSON.parse(body) as Preset;
        await updatePreset(originalName, preset);
        res.writeHead(200).end("OK");
      } catch {
        res.writeHead(400).end("Bad Request");
      }
      return;
    }
    if (url.pathname === "/api/session" && req.method === "GET") {
      const session = await loadSession();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(session));
      return;
    }

    // 정적 파일 서빙
    await serveStatic(url.pathname, staticDir, res);
  });

  // WebSocket 서버
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    // 새 연결 시 이전 연결 교체 (새로고침/재접속 허용)
    if (activeWs) {
      activeWs.close(1000, "새 연결로 교체");
      activeWs = null;
    }

    activeWs = ws;

    // 살아있는 세션이 있으면 sync, 없으면 restore-session 흐름
    const activeSessions = ptyManager.getActiveSessions();
    if (activeSessions.length > 0) {
      send(ws, { type: "sync", sessions: activeSessions });
    } else if (presetName) {
      // --preset 모드: 프리셋을 로드하여 전송
      loadPresets().then((presets) => {
        const found = presets.find((p) => p.name === presetName);
        if (found) {
          send(ws, { type: "restore-session", panels: found.panels, source: "preset" });
        } else {
          console.warn(
            `[DECK] 프리셋 "${presetName}"을 찾을 수 없습니다. 세션 복원으로 대체합니다.`,
          );
          loadSession().then((session) => {
            if (session && session.panels.length > 0) {
              send(ws, { type: "restore-session", panels: session.panels });
            }
          });
        }
      });
    } else {
      loadSession().then((session) => {
        if (session && session.panels.length > 0) {
          send(ws, { type: "restore-session", panels: session.panels });
        }
      });
    }

    ws.on("message", (raw) => {
      const data = typeof raw === "string" ? raw : raw.toString();
      handleMessage(data, ptyManager, (msg) => send(ws, msg), port);
    });

    ws.on("close", () => {
      if (activeWs === ws) activeWs = null;
    });
  });

  server.listen(port, hostname);

  // 훅 엔드포인트 핸들러 — 스크립트가 panelId + Claude 페이로드를 함께 전송
  function handleHookNotify(req: IncomingMessage, res: ServerResponse): Promise<void> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const { panelId, payload } = JSON.parse(body);
          console.log("[hook]", {
            panelId,
            event: payload?.hook_event_name,
            hasWs: !!activeWs,
            hasPanel: ptyManager.has(panelId),
          });
          if (panelId && activeWs && ptyManager.has(panelId)) {
            const message = payload?.hook_event_name === "Stop" ? "stop" : "input";
            send(activeWs, { type: "hook-notify", panelId, message });
          }
          res.writeHead(200).end("OK");
        } catch {
          res.writeHead(400).end("Bad Request");
        }
        resolve();
      });
    });
  }

  return { server, wss, ptyManager };
}

/** HTTP 요청 본문 읽기 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
  });
}

/** 정적 파일 서빙 */
async function serveStatic(
  pathname: string,
  staticDir: string,
  res: ServerResponse,
): Promise<void> {
  const filePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = join(staticDir, filePath);

  try {
    await stat(fullPath);
    const content = await readFile(fullPath);
    const ext = extname(fullPath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    // SPA 폴백
    const indexPath = join(staticDir, "index.html");
    try {
      const content = await readFile(indexPath);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
    } catch {
      res.writeHead(404).end("Not Found");
    }
  }
}
