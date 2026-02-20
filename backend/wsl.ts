import { execFileSync, execFile } from "node:child_process";

export const isWindows = process.platform === "win32";

let _wslHomedir: string | null = null;

/** WSL 홈 디렉토리를 반환한다. 결과를 캐시. 실패 시 "/root" 폴백. */
export function getWslHomedir(): string {
  if (_wslHomedir) return _wslHomedir;
  try {
    _wslHomedir = execFileSync("wsl.exe", ["-e", "sh", "-c", "echo $HOME"], {
      encoding: "utf-8",
    }).trim();
  } catch {
    _wslHomedir = "/root";
  }
  return _wslHomedir;
}

/**
 * 경로를 WSL 경로로 변환한다.
 * - "/" 시작 → 그대로 반환
 * - "~" 시작 → getWslHomedir()로 치환
 * - "C:\foo" → "/mnt/c/foo" 변환
 * - 비-Windows → 그대로 반환
 */
export function toWslPath(inputPath: string): string {
  if (!isWindows) return inputPath;

  // 이미 POSIX 경로
  if (inputPath.startsWith("/")) return inputPath;

  // ~ 확장
  if (inputPath.startsWith("~")) {
    return inputPath.replace("~", getWslHomedir());
  }

  // Windows 드라이브 경로: C:\foo → /mnt/c/foo
  const driveMatch = inputPath.match(/^([A-Za-z]):[/\\](.*)/);
  if (driveMatch) {
    const drive = driveMatch[1].toLowerCase();
    const rest = driveMatch[2].replace(/\\/g, "/");
    return `/mnt/${drive}/${rest}`;
  }

  return inputPath;
}

/**
 * 명령어를 wsl.exe로 래핑한다.
 * 비-Windows → 그대로 반환.
 */
export function wrapForWsl(
  command: string,
  args: string[],
  cwd: string,
): { command: string; args: string[]; cwd: string } {
  if (!isWindows) return { command, args, cwd };

  const wslCwd = toWslPath(cwd);
  return {
    command: "wsl.exe",
    args: ["--cd", wslCwd, "--", command, ...args],
    cwd: wslCwd,
  };
}

/** WSL에서 명령을 실행하고 stdout을 반환한다. */
export function wslExec(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("wsl.exe", ["-e", "sh", "-c", command], { encoding: "utf-8" }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}
