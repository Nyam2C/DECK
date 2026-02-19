import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";

// node-pty 모킹
vi.mock("node-pty", () => ({
  spawn: vi.fn(() => ({
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn(),
  })),
}));

// session-manager 모킹
const mockPresets = [
  {
    name: "dev",
    panels: [{ cli: "claude", path: "/home", options: "--model opus" }],
    createdAt: "2025-01-01",
  },
];
const mockSession = {
  panels: [{ cli: "claude", path: "/tmp", options: "--model sonnet" }],
  updatedAt: "2025-01-01",
};

vi.mock("../session-manager", () => ({
  loadPresets: vi.fn(() => Promise.resolve(mockPresets)),
  savePreset: vi.fn(() => Promise.resolve()),
  deletePreset: vi.fn(() => Promise.resolve()),
  loadSession: vi.fn(() => Promise.resolve(mockSession)),
  saveSession: vi.fn(() => Promise.resolve()),
}));

import { createServer } from "../server";

describe("createServer", () => {
  let result: ReturnType<typeof createServer>;
  const PORT = 13579; // 테스트 전용 포트

  beforeEach(() => {
    vi.clearAllMocks();
    result = createServer({ port: PORT, hostname: "127.0.0.1", staticDir: "/tmp/dist" });
  });

  afterEach(async () => {
    result.ptyManager.killAll();
    result.wss.clients.forEach((ws) => ws.terminate());
    result.server.closeAllConnections();
    await new Promise<void>((resolve) => result.server.close(() => resolve()));
  });

  it("서버와 ptyManager를 반환한다", () => {
    expect(result.server).toBeDefined();
    expect(result.ptyManager).toBeDefined();
  });

  it("지정된 포트에서 리슨한다", async () => {
    await new Promise<void>((resolve) => {
      result.server.once("listening", resolve);
      if (result.server.listening) resolve();
    });
    const addr = result.server.address();
    expect(addr).not.toBeNull();
    if (typeof addr === "object" && addr) {
      expect(addr.port).toBe(PORT);
    }
  });

  it("WebSocket 연결이 성공한다", async () => {
    await waitForServer();
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    await waitForOpen(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("이미 연결된 WebSocket이 있으면 이전 연결을 닫고 새 연결로 교체한다", async () => {
    await waitForServer();

    const ws1 = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    await waitForOpen(ws1);

    const closedPromise = new Promise<number>((resolve) => {
      ws1.on("close", (code) => resolve(code));
    });

    const ws2 = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    await waitForOpen(ws2);

    const closeCode = await closedPromise;
    expect(closeCode).toBe(1000);
    expect(ws2.readyState).toBe(WebSocket.OPEN);

    ws2.close();
    await waitForClose(ws2);
  });

  it("POST /hook/notify가 OK 응답을 반환한다", async () => {
    await waitForServer();

    // WebSocket 연결 먼저
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    await waitForOpen(ws);

    const res = await fetch(`http://127.0.0.1:${PORT}/hook/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelId: "test-panel", message: "done" }),
    });
    expect(res.status).toBe(200);

    ws.close();
  });

  it("POST /hook/notify에 잘못된 JSON 시 400을 반환한다", async () => {
    await waitForServer();

    const res = await fetch(`http://127.0.0.1:${PORT}/hook/notify`, {
      method: "POST",
      body: "invalid",
    });
    expect(res.status).toBe(400);
  });

  it("알 수 없는 경로에서 404를 반환한다", async () => {
    await waitForServer();

    const res = await fetch(`http://127.0.0.1:${PORT}/nonexistent`);
    expect(res.status).toBe(404);
  });

  it("WebSocket close 후 재연결이 가능하다", async () => {
    await waitForServer();

    const ws1 = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    await waitForOpen(ws1);
    ws1.close();
    await waitForClose(ws1);

    const ws2 = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    await waitForOpen(ws2);
    expect(ws2.readyState).toBe(WebSocket.OPEN);
    ws2.close();
  });

  it("WebSocket 메시지 핸들러가 문자열 메시지를 처리한다", async () => {
    await waitForServer();

    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    await waitForOpen(ws);

    const msgPromise = new Promise<string>((resolve) => {
      ws.on("message", (data) => resolve(data.toString()));
    });

    // 잘못된 JSON → 에러 응답
    ws.send("invalid json");
    const reply = JSON.parse(await msgPromise);
    expect(reply.type).toBe("error");

    ws.close();
  });

  // ─── 프리셋 API ───

  it("GET /api/presets가 프리셋 목록을 반환한다", async () => {
    await waitForServer();
    const res = await fetch(`http://127.0.0.1:${PORT}/api/presets`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("dev");
  });

  it("POST /api/presets로 프리셋을 저장한다", async () => {
    await waitForServer();
    const res = await fetch(`http://127.0.0.1:${PORT}/api/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test",
        panels: [{ cli: "bash", path: "/tmp", options: "" }],
        createdAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(200);
  });

  it("POST /api/presets에 잘못된 JSON 시 400을 반환한다", async () => {
    await waitForServer();
    const res = await fetch(`http://127.0.0.1:${PORT}/api/presets`, {
      method: "POST",
      body: "invalid",
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/presets/:name으로 프리셋을 삭제한다", async () => {
    await waitForServer();
    const res = await fetch(`http://127.0.0.1:${PORT}/api/presets/dev`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/session이 세션 데이터를 반환한다", async () => {
    await waitForServer();
    const res = await fetch(`http://127.0.0.1:${PORT}/api/session`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.panels).toHaveLength(1);
    expect(data.panels[0].cli).toBe("claude");
  });

  // ─── 세션 복원 ───

  it("WebSocket 연결 시 restore-session 메시지를 전송한다", async () => {
    await waitForServer();
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);

    // open 전에 메시지 핸들러 등록 (restore-session이 즉시 전송되므로)
    const msgPromise = new Promise<string>((resolve) => {
      ws.on("message", (data) => resolve(data.toString()));
    });
    await waitForOpen(ws);

    const parsed = JSON.parse(await msgPromise);
    expect(parsed.type).toBe("restore-session");
    expect(parsed.panels).toHaveLength(1);
    expect(parsed.panels[0].cli).toBe("claude");

    ws.close();
  });

  // 헬퍼
  function waitForServer(): Promise<void> {
    return new Promise((resolve) => {
      if (result.server.listening) return resolve();
      result.server.once("listening", resolve);
    });
  }

  function waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });
  }

  function waitForClose(ws: WebSocket): Promise<void> {
    return new Promise((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) return resolve();
      ws.on("close", () => resolve());
    });
  }
});
