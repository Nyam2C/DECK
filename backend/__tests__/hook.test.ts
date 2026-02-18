import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
const mockChmod = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  chmod: mockChmod,
}));

import { checkHook, registerHook } from "../hook";

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteFile.mockResolvedValue(undefined);
  mockChmod.mockResolvedValue(undefined);
});

// DECK 훅 식별용 커맨드 (deck-notify 마커 포함)
const deckCommand = "/home/user/.claude/hooks/deck-notify.sh";

/** Stop + Notification 모두에 훅이 등록된 settings 생성 헬퍼 */
function bothEventsSettings(command: string) {
  const entry = { hooks: [{ type: "command", command }] };
  return JSON.stringify({
    hooks: { Stop: [entry], Notification: [entry] },
  });
}

describe("checkHook", () => {
  it("Stop과 Notification 모두 DECK 훅이 있으면 true를 반환한다", async () => {
    mockReadFile.mockResolvedValue(bothEventsSettings(deckCommand));

    expect(await checkHook(3000)).toBe(true);
  });

  it("Notification만 있으면 false를 반환한다", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        hooks: {
          Notification: [{ hooks: [{ type: "command", command: deckCommand }] }],
        },
      }),
    );

    expect(await checkHook(3000)).toBe(false);
  });

  it("훅이 등록되어 있지 않으면 false를 반환한다", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: "echo hello" }] }],
          Notification: [{ hooks: [{ type: "command", command: "echo hello" }] }],
        },
      }),
    );

    expect(await checkHook(3000)).toBe(false);
  });

  it("파일이 없으면 false를 반환한다", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    expect(await checkHook(3000)).toBe(false);
  });

  it("hooks 필드가 없으면 false를 반환한다", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ env: {} }));

    expect(await checkHook(3000)).toBe(false);
  });

  it("구 포맷 훅도 감지한다", async () => {
    const entry = { type: "command", command: deckCommand };
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        hooks: { Stop: [entry], Notification: [entry] },
      }),
    );

    expect(await checkHook(3000)).toBe(true);
  });

  it("이벤트 필드가 없으면 false를 반환한다", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ hooks: {} }));

    expect(await checkHook(3000)).toBe(false);
  });
});

describe("registerHook", () => {
  it("빈 설정 파일에 훅을 추가한다", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    await registerHook(3000);

    const settingsCall = mockWriteFile.mock.calls.find((c: string[]) =>
      c[0].includes("settings.json"),
    );
    const scriptCall = mockWriteFile.mock.calls.find((c: string[]) =>
      c[0].includes("deck-notify.sh"),
    );

    expect(settingsCall).toBeDefined();
    expect(scriptCall).toBeDefined();

    // Stop + Notification 모두에 등록됨
    const written = JSON.parse(settingsCall![1] as string);
    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Notification).toHaveLength(1);
    expect(written.hooks.Stop[0].hooks[0].command).toContain("deck-notify.sh");
    expect(written.hooks.Notification[0].hooks[0].command).toContain("deck-notify.sh");

    // 스크립트에 curl과 DECK_PANEL_ID가 포함됨
    expect(scriptCall![1]).toContain("curl");
    expect(scriptCall![1]).toContain("DECK_PANEL_ID");

    // 실행 권한 부여
    expect(mockChmod).toHaveBeenCalledWith(expect.stringContaining("deck-notify.sh"), 0o755);
  });

  it("기존 설정을 보존하면서 훅을 추가한다", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        env: { DEBUG: "true" },
        hooks: {
          Notification: [{ hooks: [{ type: "command", command: "echo other" }] }],
        },
      }),
    );

    await registerHook(4000);

    const settingsCall = mockWriteFile.mock.calls.find((c: string[]) =>
      c[0].includes("settings.json"),
    );
    const written = JSON.parse(settingsCall![1] as string);
    expect(written.env).toEqual({ DEBUG: "true" });
    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Notification).toHaveLength(2);
    expect(written.hooks.Notification[0].hooks[0].command).toBe("echo other");
    expect(written.hooks.Notification[1].hooks[0].command).toContain("deck-notify.sh");
  });

  it("이미 등록된 DECK 훅이 있으면 교체한다", async () => {
    mockReadFile.mockResolvedValue(bothEventsSettings(deckCommand));

    await registerHook(5000);

    const settingsCall = mockWriteFile.mock.calls.find((c: string[]) =>
      c[0].includes("settings.json"),
    );
    const written = JSON.parse(settingsCall![1] as string);
    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Notification).toHaveLength(1);
    expect(written.hooks.Stop[0].hooks[0].command).toContain("deck-notify.sh");

    // 스크립트가 새 포트로 생성됨
    const scriptCall = mockWriteFile.mock.calls.find((c: string[]) =>
      c[0].includes("deck-notify.sh"),
    );
    expect(scriptCall![1]).toContain("127.0.0.1:5000");
  });

  it("구 포맷 DECK 훅도 제거하고 새 포맷으로 등록한다", async () => {
    const entry = { type: "command", command: deckCommand };
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        hooks: { Stop: [entry], Notification: [entry] },
      }),
    );

    await registerHook(4000);

    const settingsCall = mockWriteFile.mock.calls.find((c: string[]) =>
      c[0].includes("settings.json"),
    );
    const written = JSON.parse(settingsCall![1] as string);
    expect(written.hooks.Stop).toHaveLength(1);
    expect(written.hooks.Notification).toHaveLength(1);
    expect(written.hooks.Notification[0].hooks[0].command).toContain("deck-notify.sh");
  });

  it("디렉토리 생성을 시도한다", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    await registerHook(3000);

    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining(".claude"), { recursive: true });
  });
});
