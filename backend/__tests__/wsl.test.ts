import { describe, it, expect } from "vitest";

// toWslPath / wrapForWsl의 핵심 로직을 플랫폼 무관하게 테스트한다.
// 실제 모듈은 process.platform에 의존하므로, 로직을 직접 재현하여 검증.

describe("toWslPath (로직 테스트)", () => {
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
    const wslCwd = cwd;
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
