import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const SCRIPT_PATH = join(homedir(), ".claude", "hooks", "deck-notify.sh");

/** DECK 훅 식별 키워드 */
const DECK_MARKER = "DECK_PANEL_ID";

function buildScript(port: number): string {
  return `#!/bin/bash
cat > /dev/null
B='{"panelId":"'$DECK_PANEL_ID'","message":"input"}'
exec 3<>/dev/tcp/127.0.0.1/${port} 2>/dev/null && printf 'POST /hook/notify HTTP/1.0\\r\\nContent-Type: application/json\\r\\nContent-Length: %s\\r\\n\\r\\n%s' "\${#B}" "$B" >&3 && exec 3>&-
`;
}

/** 훅 스크립트 파일을 생성/갱신한다. */
async function writeScript(port: number): Promise<void> {
  await mkdir(dirname(SCRIPT_PATH), { recursive: true });
  await writeFile(SCRIPT_PATH, buildScript(port), "utf-8");
  await chmod(SCRIPT_PATH, 0o755);
}

// Notification 배열 항목은 구 포맷/새 포맷 모두 올 수 있으므로 느슨하게 정의
type NotificationEntry = Record<string, unknown>;

/** settings.json을 안전하게 읽는다. 파일 없으면 빈 객체 반환. */
async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** settings.json에 저장한다. 디렉토리가 없으면 생성. */
async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/** Notification 배열을 추출한다. */
function getNotificationEntries(settings: Record<string, unknown>): NotificationEntry[] {
  const hooks = settings.hooks as Record<string, unknown> | undefined;
  if (!hooks) return [];
  const arr = hooks.Notification;
  return Array.isArray(arr) ? (arr as NotificationEntry[]) : [];
}

/** 커맨드 문자열이 DECK 훅인지 확인 */
function isDeckCommand(command: string): boolean {
  return command.includes(DECK_MARKER) || command.includes("deck-notify.sh");
}

/** 항목에 DECK 마커가 있는지 확인 (새 포맷 + 구 포맷 호환) */
function entryHasDeckHook(entry: NotificationEntry): boolean {
  // 새 포맷: { hooks: [{ command: "..." }] }
  if (Array.isArray(entry.hooks)) {
    return entry.hooks.some(
      (h: NotificationEntry) => typeof h.command === "string" && isDeckCommand(h.command),
    );
  }
  // 구 포맷: { type: "command", command: "..." }
  if (typeof entry.command === "string") {
    return isDeckCommand(entry.command);
  }
  return false;
}

/** ~/.claude/settings.json에 DECK 훅이 등록되어 있는지 확인 */
export async function checkHook(_port: number): Promise<boolean> {
  const settings = await readSettings();
  const entries = getNotificationEntries(settings);
  return entries.some(entryHasDeckHook);
}

/** DECK 훅을 ~/.claude/settings.json에 등록 */
export async function registerHook(port: number): Promise<void> {
  const settings = await readSettings();

  if (!settings.hooks) settings.hooks = {};
  const hooks = settings.hooks as Record<string, unknown>;

  const existing = Array.isArray(hooks.Notification)
    ? (hooks.Notification as NotificationEntry[])
    : [];

  // 기존 DECK 항목 제거 (구 포맷 + 새 포맷 모두, 포트 교체 대응)
  const filtered = existing.filter((e) => !entryHasDeckHook(e));

  // 스크립트 파일 생성/갱신
  await writeScript(port);

  // 새 항목 추가 (matcher + hooks 포맷) — 스크립트 경로를 커맨드로 등록
  filtered.push({
    hooks: [{ type: "command", command: SCRIPT_PATH }],
  });

  hooks.Notification = filtered;
  await writeSettings(settings);
}

/** 테스트용: settings 경로 반환 */
export const _settingsPath = SETTINGS_PATH;
