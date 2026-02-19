import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSessionManager } from "../session-manager";
import type { Preset, PresetPanel } from "../types";

describe("session-manager", () => {
  let dir: string;
  let manager: ReturnType<typeof createSessionManager>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "deck-test-"));
    manager = createSessionManager(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // ─── 프리셋 ───

  it("프리셋이 없으면 빈 배열을 반환한다", async () => {
    expect(await manager.loadPresets()).toEqual([]);
  });

  it("프리셋 저장 후 로드하면 동일하다", async () => {
    const preset: Preset = {
      name: "test",
      panels: [{ cli: "claude", path: "/tmp", options: "--model sonnet" }],
      createdAt: new Date().toISOString(),
    };
    await manager.savePreset(preset);
    const loaded = await manager.loadPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("test");
    expect(loaded[0].panels[0].cli).toBe("claude");
  });

  it("동일 이름 프리셋은 덮어쓴다", async () => {
    const preset1: Preset = {
      name: "dup",
      panels: [{ cli: "a", path: "/a", options: "" }],
      createdAt: new Date().toISOString(),
    };
    const preset2: Preset = {
      name: "dup",
      panels: [{ cli: "b", path: "/b", options: "--x" }],
      createdAt: new Date().toISOString(),
    };
    await manager.savePreset(preset1);
    await manager.savePreset(preset2);
    const loaded = await manager.loadPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].panels[0].cli).toBe("b");
  });

  it("프리셋 삭제 후 목록에서 제거된다", async () => {
    await manager.savePreset({
      name: "del",
      panels: [],
      createdAt: new Date().toISOString(),
    });
    await manager.deletePreset("del");
    expect(await manager.loadPresets()).toEqual([]);
  });

  // ─── 세션 ───

  it("세션 파일이 없으면 null을 반환한다", async () => {
    expect(await manager.loadSession()).toBeNull();
  });

  it("세션 저장 후 로드 라운드트립", async () => {
    const panels: PresetPanel[] = [{ cli: "claude", path: "/home", options: "--model opus" }];
    await manager.saveSession(panels);
    const session = await manager.loadSession();
    expect(session).not.toBeNull();
    expect(session!.panels).toHaveLength(1);
    expect(session!.panels[0].cli).toBe("claude");
    expect(session!.updatedAt).toBeTruthy();
  });
});
