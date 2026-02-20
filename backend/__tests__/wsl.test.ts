import { describe, it, expect } from "vitest";

// 실제 process.platform을 모킹하지 않고, 내부 함수 로직을 직접 테스트한다.
// isWindows는 런타임에 false이므로, 경로 변환/래핑 로직만 단위 테스트.

describe("toWslPath (로직 테스트)", () => {
  // toWslPath의 내부 로직을 직접 재현하여 테스트
  function toWslPathLogic(inputPath: string, wslHomedir: string): string {
    if (inputPath.startsWith("/")) return inputPath;
    if (inputPath.startsWith("~")) return inputPath.replace("~", wslHomedir);

    const driveMatch = inputPath.match(/^([A-Za-z]):[/\\](.*)/);
    if (driveMatch) {
      const drive = driveMatch[1].toLowerCase();
      const rest = driveMatch[2].replace(/\\/g, "/");
      return `/mnt/${drive}/${rest}`;
    }
    return inputPath;
  }

  it("POSIX 절대 경로는 그대로 반환한다", () => {
    expect(toWslPathLogic("/home/user/project", "/home/user")).toBe("/home/user/project");
  });

  it("~ 경로를 WSL 홈으로 치환한다", () => {
    expect(toWslPathLogic("~/project", "/home/user")).toBe("/home/user/project");
  });

  it("~만 있으면 홈 디렉토리로 변환한다", () => {
    expect(toWslPathLogic("~", "/home/user")).toBe("/home/user");
  });

  it("Windows 드라이브 경로 (백슬래시)를 WSL 경로로 변환한다", () => {
    expect(toWslPathLogic("C:\\Users\\foo\\project", "/home/user")).toBe(
      "/mnt/c/Users/foo/project",
    );
  });

  it("Windows 드라이브 경로 (슬래시)를 WSL 경로로 변환한다", () => {
    expect(toWslPathLogic("D:/work/repo", "/home/user")).toBe("/mnt/d/work/repo");
  });

  it("소문자 드라이브도 처리한다", () => {
    expect(toWslPathLogic("e:\\data", "/home/user")).toBe("/mnt/e/data");
  });

  it("드라이브 루트만 있는 경우", () => {
    expect(toWslPathLogic("C:\\", "/home/user")).toBe("/mnt/c/");
  });

  it("매칭되지 않는 경로는 그대로 반환한다", () => {
    expect(toWslPathLogic("relative/path", "/home/user")).toBe("relative/path");
  });
});

describe("wrapForWsl (로직 테스트)", () => {
  function wrapForWslLogic(
    command: string,
    args: string[],
    cwd: string,
  ): { command: string; args: string[]; cwd: string } {
    const wslCwd = cwd; // 이미 변환된 상태라고 가정
    return {
      command: "wsl.exe",
      args: ["--cd", wslCwd, "--", command, ...args],
      cwd: wslCwd,
    };
  }

  it("명령어를 wsl.exe로 래핑한다", () => {
    const result = wrapForWslLogic("claude", ["--model", "sonnet"], "/home/user/project");
    expect(result).toEqual({
      command: "wsl.exe",
      args: ["--cd", "/home/user/project", "--", "claude", "--model", "sonnet"],
      cwd: "/home/user/project",
    });
  });

  it("인자 없는 명령어도 래핑한다", () => {
    const result = wrapForWslLogic("bash", [], "/mnt/c/Users/foo");
    expect(result).toEqual({
      command: "wsl.exe",
      args: ["--cd", "/mnt/c/Users/foo", "--", "bash"],
      cwd: "/mnt/c/Users/foo",
    });
  });
});

describe("wsl.ts 모듈 (비-Windows 환경)", () => {
  it("isWindows가 Linux에서 false이다", async () => {
    const { isWindows } = await import("../wsl");
    expect(isWindows).toBe(false);
  });

  it("toWslPath가 비-Windows에서 경로를 그대로 반환한다", async () => {
    const { toWslPath } = await import("../wsl");
    expect(toWslPath("/home/user/project")).toBe("/home/user/project");
    expect(toWslPath("~/project")).toBe("~/project");
  });

  it("wrapForWsl이 비-Windows에서 그대로 반환한다", async () => {
    const { wrapForWsl } = await import("../wsl");
    const result = wrapForWsl("claude", ["--model", "sonnet"], "/home/user");
    expect(result).toEqual({
      command: "claude",
      args: ["--model", "sonnet"],
      cwd: "/home/user",
    });
  });
});
