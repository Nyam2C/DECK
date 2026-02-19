import { describe, it, expect, vi } from "vitest";
import { handleMessage } from "../message-handler";
import type { PtyManager } from "../pty-manager";
import type { ServerMessage } from "../types";

vi.mock("../session-manager", () => ({
  saveSession: vi.fn(),
  hasClaudeConversations: vi.fn().mockResolvedValue(true),
}));

function mockPtyManager(overrides = {}): PtyManager {
  return {
    create: vi.fn().mockReturnValue("test-id"),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    killAll: vi.fn(),
    getActivePanels: vi.fn().mockReturnValue([]),
    count: 0,
    has: vi.fn().mockReturnValue(true),
    ...overrides,
  } as unknown as PtyManager;
}

describe("handleMessage", () => {
  it("create 메시지를 처리하여 created 응답을 보낸다", async () => {
    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({ type: "create", cli: "claude", path: "/tmp", options: "--model sonnet" }),
      manager,
      send,
      3000,
    );

    expect(manager.create).toHaveBeenCalledWith(
      "claude",
      ["--model", "sonnet"],
      "/tmp",
      80,
      24,
      undefined,
      "claude",
      "--model sonnet",
    );
    expect(send).toHaveBeenCalledWith({ type: "created", panelId: "test-id" });
  });

  it("input 메시지를 처리하여 PTY에 데이터를 쓴다", async () => {
    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({ type: "input", panelId: "abc", data: "hello" }),
      manager,
      send,
      3000,
    );

    expect(manager.write).toHaveBeenCalledWith("abc", "hello");
  });

  it("resize 메시지를 처리한다", async () => {
    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({ type: "resize", panelId: "abc", cols: 120, rows: 40 }),
      manager,
      send,
      3000,
    );

    expect(manager.resize).toHaveBeenCalledWith("abc", 120, 40);
  });

  it("kill 메시지를 처리한다", async () => {
    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(JSON.stringify({ type: "kill", panelId: "abc" }), manager, send, 3000);

    expect(manager.kill).toHaveBeenCalledWith("abc");
  });

  it("잘못된 JSON에 에러 응답을 보낸다", async () => {
    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage("not json", manager, send, 3000);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("create 실패 시 에러 응답을 보낸다", async () => {
    const manager = mockPtyManager({
      create: vi.fn().mockImplementation(() => {
        throw new Error("최대 4개 세션까지 생성 가능");
      }),
    });
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({ type: "create", cli: "claude", path: "/tmp", options: "" }),
      manager,
      send,
      3000,
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "최대 4개 세션까지 생성 가능" }),
    );
  });

  it("input 실패 시 에러 응답을 보낸다", async () => {
    const manager = mockPtyManager({
      write: vi.fn().mockImplementation(() => {
        throw new Error("세션 없음: abc");
      }),
    });
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({ type: "input", panelId: "abc", data: "hello" }),
      manager,
      send,
      3000,
    );

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "error", panelId: "abc" }));
  });

  it("resize 실패 시 에러 응답을 보낸다", async () => {
    const manager = mockPtyManager({
      resize: vi.fn().mockImplementation(() => {
        throw new Error("세션 없음: abc");
      }),
    });
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({ type: "resize", panelId: "abc", cols: 120, rows: 40 }),
      manager,
      send,
      3000,
    );

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "error", panelId: "abc" }));
  });

  it("autocomplete 메시지를 처리한다", async () => {
    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({ type: "autocomplete", partial: "/tmp" }),
      manager,
      send,
      3000,
    );

    // autocomplete는 비동기이므로 대기
    await new Promise((r) => setTimeout(r, 200));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "autocomplete-result" }));
  });

  it("알 수 없는 메시지 타입에 에러 응답을 보낸다", async () => {
    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(JSON.stringify({ type: "unknown" }), manager, send, 3000);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "알 수 없는 메시지 타입" }),
    );
  });

  it("options가 빈 문자열일 때 빈 args 배열을 전달한다", async () => {
    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({ type: "create", cli: "bash", path: "/tmp", options: "" }),
      manager,
      send,
      3000,
    );

    expect(manager.create).toHaveBeenCalledWith("bash", [], "/tmp", 80, 24, undefined, "bash", "");
  });

  it("Claude -r 옵션에서 대화 기록이 없으면 -r을 제거한다", async () => {
    const { hasClaudeConversations } = await import("../session-manager");
    vi.mocked(hasClaudeConversations).mockResolvedValueOnce(false);

    const manager = mockPtyManager();
    const send = vi.fn<(msg: ServerMessage) => void>();

    await handleMessage(
      JSON.stringify({
        type: "create",
        cli: "claude",
        path: "/tmp/no-conversations",
        options: "--model opus -r",
      }),
      manager,
      send,
      3000,
    );

    expect(manager.create).toHaveBeenCalledWith(
      "claude",
      ["--model", "opus"],
      "/tmp/no-conversations",
      80,
      24,
      undefined,
      "claude",
      "--model opus",
    );
  });
});
