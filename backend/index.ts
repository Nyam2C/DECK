import { createServer } from "./server";
import { resolve } from "path";

const PORT = Number(process.env.DECK_PORT) || 3000;
const HOSTNAME = "127.0.0.1";
const STATIC_DIR = resolve(import.meta.dir, "../frontend/dist");

const { server, ptyManager } = createServer({
  port: PORT,
  hostname: HOSTNAME,
  staticDir: STATIC_DIR,
});

console.log(`DECK 서버 시작: http://${HOSTNAME}:${PORT}`);

// 시그널 핸들링: 정상 종료 시 모든 PTY 정리
function shutdown() {
  console.log("\nDECK 서버 종료 중...");
  ptyManager.killAll();
  server.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
