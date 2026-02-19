import { describe, it, expect } from "vitest";
import {
  claudeCodeProvider,
  customProvider,
  getProvider,
  getProviderList,
  ensureResumeFlag,
} from "../../services/cli-provider";

describe("claudeCodeProvider.buildCommand", () => {
  it("기본값으로 명령어를 조합한다", () => {
    const defaults: Record<string, unknown> = {};
    for (const opt of claudeCodeProvider.options) {
      defaults[opt.key] = opt.defaultValue;
    }
    const cmd = claudeCodeProvider.buildCommand(defaults);
    expect(cmd).toBe("claude --model opus --permission-mode plan");
  });

  it("모든 기본 옵션을 반영한다", () => {
    const state: Record<string, unknown> = {
      session: "continue",
      permissionMode: "turbo",
      skipPermissions: true,
      model: "sonnet",
    };
    const cmd = claudeCodeProvider.buildCommand(state);
    expect(cmd).toContain("--model sonnet");
    expect(cmd).toContain("--permission-mode turbo");
    expect(cmd).toContain("--dangerously-skip-permissions");
    expect(cmd).toContain("-c");
  });

  it("resume 세션 플래그를 추가한다", () => {
    const cmd = claudeCodeProvider.buildCommand({
      session: "resume",
      model: "opus",
      permissionMode: "plan",
    });
    expect(cmd).toContain("-r");
    expect(cmd).not.toContain("-c");
  });

  it("new 세션일 때 세션 플래그가 없다", () => {
    const cmd = claudeCodeProvider.buildCommand({
      session: "new",
      model: "opus",
      permissionMode: "plan",
    });
    expect(cmd).not.toContain("-c");
    expect(cmd).not.toContain("-r");
  });

  it("고급 옵션을 반영한다", () => {
    const state: Record<string, unknown> = {
      session: "new",
      model: "opus",
      permissionMode: "plan",
      allowedTools: "Bash(git *),Read",
      verbose: true,
      chrome: true,
    };
    const cmd = claudeCodeProvider.buildCommand(state);
    expect(cmd).toContain('--allowedTools "Bash(git *),Read"');
    expect(cmd).toContain("--verbose");
    expect(cmd).toContain("--chrome");
  });

  it("extraFlags를 직접 이어붙인다", () => {
    const state: Record<string, unknown> = {
      session: "new",
      model: "opus",
      permissionMode: "plan",
      extraFlags: "--some-flag value",
    };
    const cmd = claudeCodeProvider.buildCommand(state);
    expect(cmd).toContain("--some-flag value");
  });

  it("빈 고급 옵션은 무시한다", () => {
    const state: Record<string, unknown> = {
      session: "new",
      model: "opus",
      permissionMode: "plan",
      allowedTools: "",
      verbose: false,
    };
    const cmd = claudeCodeProvider.buildCommand(state);
    expect(cmd).not.toContain("--allowedTools");
    expect(cmd).not.toContain("--verbose");
  });
});

describe("customProvider.buildCommand", () => {
  it("명령어를 그대로 반환한다", () => {
    const cmd = customProvider.buildCommand({ command: "aider --model gpt-4o" });
    expect(cmd).toBe("aider --model gpt-4o");
  });

  it("앞뒤 공백을 제거한다", () => {
    const cmd = customProvider.buildCommand({ command: "  bash  " });
    expect(cmd).toBe("bash");
  });

  it("빈 값이면 빈 문자열을 반환한다", () => {
    const cmd = customProvider.buildCommand({ command: "" });
    expect(cmd).toBe("");
    const cmd2 = customProvider.buildCommand({});
    expect(cmd2).toBe("");
  });
});

describe("getProvider / getProviderList", () => {
  it("claude로 Claude Code 프로바이더를 반환한다", () => {
    const p = getProvider("claude");
    expect(p.name).toBe("Claude Code");
    expect(p.hookSupported).toBe(true);
  });

  it("custom으로 커스텀 프로바이더를 반환한다", () => {
    const p = getProvider("custom");
    expect(p.name).toBe("커스텀");
    expect(p.hookSupported).toBe(false);
  });

  it("알 수 없는 키는 커스텀 프로바이더로 폴백한다", () => {
    const p = getProvider("unknown");
    expect(p.name).toBe("커스텀");
  });

  it("getProviderList는 2개의 프로바이더를 반환한다", () => {
    const list = getProviderList();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("Claude Code");
    expect(list[1].name).toBe("커스텀");
  });
});

describe("ensureResumeFlag", () => {
  it("이미 -r이 있으면 그대로 반환한다", () => {
    expect(ensureResumeFlag("--model opus -r")).toBe("--model opus -r");
  });

  it("이미 --resume이 있으면 그대로 반환한다", () => {
    expect(ensureResumeFlag("--resume --model opus")).toBe("--resume --model opus");
  });

  it("-c를 -r로 교체한다", () => {
    expect(ensureResumeFlag("--model opus -c")).toBe("--model opus -r");
  });

  it("플래그가 없으면 -r을 추가한다", () => {
    expect(ensureResumeFlag("--model opus")).toBe("--model opus -r");
  });

  it("빈 문자열이면 -r을 반환한다", () => {
    expect(ensureResumeFlag("")).toBe("-r");
  });
});

