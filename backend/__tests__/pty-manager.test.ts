import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// node-pty 네이티브 모듈을 모킹
function createMockPty() {
  const listeners: Record<string, Function[]> = {};
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn((cb: Function) => {
      listeners["data"] = listeners["data"] || [];
      listeners["data"].push(cb);
    }),
    onExit: vi.fn((cb: Function) => {
      listeners["exit"] = listeners["exit"] || [];
      listeners["exit"].push(cb);
    }),
    _emit(event: string, data: unknown) {
      (listeners[event] || []).forEach((cb) => cb(data));
    },
  };
}

let mockPtyInstance: ReturnType<typeof createMockPty>;

vi.mock("node-pty", () => ({
  spawn: vi.fn(() => {
    mockPtyInstance = createMockPty();
    return mockPtyInstance;
  }),
}));

import { PtyManager } from "../pty-manager";

describe("PtyManager", () => {
  let manager: PtyManager;
  let onData: ReturnType<typeof vi.fn>;
  let onExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onData = vi.fn();
    onExit = vi.fn();
    manager = new PtyManager(onData, onExit);
  });

  afterEach(() => {
    manager.killAll();
  });

  it("PTY를 생성하고 onData 콜백이 호출된다", async () => {
    const id = manager.create("echo", ["hello"], "/tmp", 80, 24);
    expect(id).toBeTruthy();
    expect(manager.has(id)).toBe(true);

    // 모킹된 PTY에서 데이터 이벤트 발생
    mockPtyInstance._emit("data", "hello\r\n");

    // 배칭(16ms) 대기 후 콜백 확인
    await new Promise((r) => setTimeout(r, 20));
    expect(onData).toHaveBeenCalledWith(id, "hello\r\n");
  });

  it("PTY 종료 시 onExit 콜백이 호출되고 세션이 제거된다", () => {
    const id = manager.create("echo", ["hello"], "/tmp", 80, 24);
    expect(manager.has(id)).toBe(true);

    // 모킹된 PTY에서 종료 이벤트 발생
    mockPtyInstance._emit("exit", { exitCode: 0 });
    expect(onExit).toHaveBeenCalledWith(id, 0);
    expect(manager.has(id)).toBe(false);
  });

  it("최대 4개 세션 제한을 적용한다", () => {
    for (let i = 0; i < 4; i++) {
      manager.create("echo", ["test"], "/tmp", 80, 24);
    }
    expect(manager.count).toBe(4);
    expect(() => manager.create("echo", ["test"], "/tmp", 80, 24)).toThrow();
  });

  it("kill로 세션을 종료한다", () => {
    const id = manager.create("sleep", ["10"], "/tmp", 80, 24);
    expect(manager.has(id)).toBe(true);
    manager.kill(id);
    expect(manager.has(id)).toBe(false);
    expect(mockPtyInstance.kill).toHaveBeenCalled();
  });

  it("resize가 에러 없이 동작한다", () => {
    const id = manager.create("sleep", ["10"], "/tmp", 80, 24);
    expect(() => manager.resize(id, 120, 40)).not.toThrow();
    expect(mockPtyInstance.resize).toHaveBeenCalledWith(120, 40);
  });

  it("존재하지 않는 세션에 write 시 에러를 던진다", () => {
    expect(() => manager.write("nonexistent", "data")).toThrow();
  });

  it("존재하지 않는 세션에 resize 시 에러를 던진다", () => {
    expect(() => manager.resize("nonexistent", 80, 24)).toThrow();
  });

  it("killAll로 모든 세션을 종료한다", () => {
    manager.create("sleep", ["10"], "/tmp", 80, 24);
    manager.create("sleep", ["10"], "/tmp", 80, 24);
    expect(manager.count).toBe(2);
    manager.killAll();
    expect(manager.count).toBe(0);
  });

  it("이미 종료된 세션에 kill 호출 시 무시한다", () => {
    expect(() => manager.kill("nonexistent")).not.toThrow();
  });

  it("DECK_PANEL_ID 환경 변수를 설정한다", async () => {
    const pty = await import("node-pty");
    const id = manager.create("echo", ["test"], "/tmp", 80, 24);

    expect(pty.spawn).toHaveBeenCalledWith(
      "echo",
      ["test"],
      expect.objectContaining({
        env: expect.objectContaining({ DECK_PANEL_ID: id }),
      }),
    );
  });
});
