import { createServer } from "./server";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.DECK_PORT) || 3000;
const HOSTNAME = "127.0.0.1";
const STATIC_DIR = resolve(__dirname, "../frontend/dist");

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
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
