import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

// Bun 글로벌 모킹
const mockWs = {
  send: vi.fn(),
  close: vi.fn(),
};

let fetchHandler: (req: Request, server: any) => any;
let wsHandlers: Record<string, Function>;

const mockServer = {
  stop: vi.fn(),
  upgrade: vi.fn().mockReturnValue(true),
};

vi.stubGlobal("Bun", {
  serve: vi.fn((config: any) => {
    fetchHandler = config.fetch;
    wsHandlers = config.websocket;
    return mockServer;
  }),
  file: vi.fn((_path: string) => ({
    exists: vi.fn().mockResolvedValue(false),
  })),
});

import { createServer } from "../server";

describe("createServer", () => {
  let result: ReturnType<typeof createServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    result = createServer({ port: 3000, hostname: "127.0.0.1", staticDir: "/tmp/dist" });
  });

  afterEach(() => {
    result.ptyManager.killAll();
  });

  it("서버와 ptyManager를 반환한다", () => {
    expect(result.server).toBeDefined();
    expect(result.ptyManager).toBeDefined();
  });

  it("Bun.serve를 올바른 설정으로 호출한다", () => {
    expect(Bun.serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3000,
        hostname: "127.0.0.1",
      }),
    );
  });

  it("/ws 경로에서 WebSocket 업그레이드를 시도한다", () => {
    const req = new Request("http://localhost:3000/ws");
    const serverArg = { upgrade: vi.fn().mockReturnValue(true) };

    const response = fetchHandler(req, serverArg);

    expect(serverArg.upgrade).toHaveBeenCalledWith(req);
    expect(response).toBeUndefined();
  });

  it("이미 연결된 WebSocket이 있으면 /ws에서 409를 반환한다", () => {
    // WebSocket 연결 시뮬레이션
    wsHandlers.open(mockWs);

    const req = new Request("http://localhost:3000/ws");
    const serverArg = { upgrade: vi.fn() };
    const response = fetchHandler(req, serverArg);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(409);

    // 정리
    wsHandlers.close(mockWs);
  });

  it("WebSocket 업그레이드 실패 시 400을 반환한다", () => {
    const req = new Request("http://localhost:3000/ws");
    const serverArg = { upgrade: vi.fn().mockReturnValue(false) };

    const response = fetchHandler(req, serverArg);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("POST /hook/notify가 OK 응답을 반환한다", async () => {
    // WebSocket 연결
    wsHandlers.open(mockWs);

    const req = new Request("http://localhost:3000/hook/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelId: "test-panel", message: "done" }),
    });
    const serverArg = {};

    const response = await fetchHandler(req, serverArg);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    wsHandlers.close(mockWs);
  });

  it("POST /hook/notify에 잘못된 JSON 시 400을 반환한다", async () => {
    const req = new Request("http://localhost:3000/hook/notify", {
      method: "POST",
      body: "invalid",
    });
    const serverArg = {};

    const response = await fetchHandler(req, serverArg);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
  });

  it("알 수 없는 경로에서 정적 파일 서빙을 시도한다", async () => {
    const req = new Request("http://localhost:3000/some/path");
    const serverArg = {};

    const response = await fetchHandler(req, serverArg);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
  });

  it("WebSocket close 시 activeWs가 null이 된다", () => {
    wsHandlers.open(mockWs);

    // 두 번째 연결이 거부되는지 확인
    const req1 = new Request("http://localhost:3000/ws");
    expect(fetchHandler(req1, { upgrade: vi.fn() }).status).toBe(409);

    // close 후에는 다시 연결 가능
    wsHandlers.close(mockWs);

    const serverArg = { upgrade: vi.fn().mockReturnValue(true) };
    const req2 = new Request("http://localhost:3000/ws");
    expect(fetchHandler(req2, serverArg)).toBeUndefined();
  });

  it("WebSocket message 핸들러가 문자열 메시지를 처리한다", () => {
    wsHandlers.open(mockWs);

    // 잘못된 JSON 전송 → 에러 응답
    wsHandlers.message(mockWs, "invalid json");

    expect(mockWs.send).toHaveBeenCalled();
    const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
    expect(sentData.type).toBe("error");

    wsHandlers.close(mockWs);
  });
});
