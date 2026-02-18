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
import type { ServerMessage } from "./types";

export interface DeckServerOptions {
  port: number;
  hostname: string;
  staticDir: string;
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
  const { port, hostname, staticDir } = options;

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

    // 새로고침 시 고아 PTY 정리
    ptyManager.killAll();

    activeWs = ws;

    ws.on("message", (raw) => {
      const data = typeof raw === "string" ? raw : raw.toString();
      handleMessage(data, ptyManager, (msg) => send(ws, msg), port);
    });

    ws.on("close", () => {
      if (activeWs === ws) activeWs = null;
    });
  });

  server.listen(port, hostname);

  // 훅 엔드포인트 핸들러
  function handleHookNotify(req: IncomingMessage, res: ServerResponse): Promise<void> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const { panelId, message } = JSON.parse(body);
          if (activeWs && panelId && message) {
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

  return { server, ptyManager };
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
