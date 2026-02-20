import { createServer } from "./server";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Windows에서 DECK_PANEL_ID, CLAUDECODE 환경변수가 WSL로 전달되도록 보장
if (process.platform === "win32") {
  const existing = process.env.WSLENV || "";
  process.env.WSLENV = existing
    ? `${existing}:DECK_PANEL_ID/u:CLAUDECODE/u`
    : "DECK_PANEL_ID/u:CLAUDECODE/u";
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.DECK_PORT) || 3000;
const HOSTNAME = "127.0.0.1";
const STATIC_DIR = process.env.DECK_STATIC_DIR || resolve(__dirname, "../frontend/dist");

// --preset 인자 파싱
const presetArgIndex = process.argv.indexOf("--preset");
const presetName = presetArgIndex >= 0 ? process.argv[presetArgIndex + 1] : undefined;

const { server, ptyManager } = createServer({
  port: PORT,
  hostname: HOSTNAME,
  staticDir: STATIC_DIR,
  preset: presetName,
});

console.log(`DECK 서버 시작: http://${HOSTNAME}:${PORT}`);

// 시그널 핸들링: 정상 종료 시 모든 PTY 정리
function shutdown() {
  console.log("\nDECK 서버 종료 중...");
  ptyManager.killAll();
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
