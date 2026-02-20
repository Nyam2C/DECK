import { spawn, execSync, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import http from "node:http";

let backendProcess: ChildProcess | null = null;
let logFn: (msg: string) => void = console.log;

const PORT = 3000;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/presets`;

function waitForBackend(maxAttempts = 150, interval = 200): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const req = http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) {
          clearInterval(timer);
          resolve();
        }
      });
      req.on("error", () => {
        if (attempts >= maxAttempts) {
          clearInterval(timer);
          reject(new Error("Backend failed to start"));
        }
      });
      req.end();
    }, interval);
  });
}

export function startBackend(log?: (msg: string) => void): Promise<void> {
  if (log) logFn = log;

  const appRoot = resolve(__dirname, "../..");
  let entryPath = resolve(appRoot, "backend/dist/index.js");
  let staticDir = resolve(appRoot, "frontend/dist");

  // asar 내부 파일은 자식 프로세스에서 접근 불가 → unpacked 경로로 변환
  entryPath = entryPath.replace("app.asar", "app.asar.unpacked");
  staticDir = staticDir.replace("app.asar", "app.asar.unpacked");

  logFn(`[backend] execPath=${process.execPath}`);
  logFn(`[backend] entryPath=${entryPath}`);
  logFn(`[backend] staticDir=${staticDir}`);

  backendProcess = spawn(process.execPath, [entryPath], {
    stdio: "pipe",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      DECK_PORT: String(PORT),
      DECK_STATIC_DIR: staticDir,
    },
  });

  backendProcess.stdout?.on("data", (data: Buffer) => {
    logFn(`[backend:stdout] ${data.toString().trim()}`);
  });

  backendProcess.stderr?.on("data", (data: Buffer) => {
    logFn(`[backend:stderr] ${data.toString().trim()}`);
  });

  backendProcess.on("exit", (code) => {
    logFn(`[backend] process exited with code ${code}`);
  });

  return waitForBackend();
}

export function stopBackend(): void {
  if (backendProcess && !backendProcess.killed && backendProcess.pid) {
    try {
      if (process.platform === "win32") {
        // Windows: 프로세스 트리 전체 강제 종료 (PTY 자식 포함)
        execSync(`taskkill /F /T /PID ${backendProcess.pid}`, { stdio: "ignore" });
      } else {
        backendProcess.kill("SIGTERM");
      }
    } catch {
      // 이미 종료된 경우 무시
    }
    backendProcess = null;
  }
}
