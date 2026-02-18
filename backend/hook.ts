import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const SCRIPT_PATH = join(homedir(), ".claude", "hooks", "deck-notify.sh");

/** DECK 훅 식별 키워드 */
const DECK_MARKER = "deck-notify";

/** Stop: 턴 종료 즉시, Notification: 중간 입력 대기 시 */
const HOOK_EVENTS = ["Stop", "Notification"] as const;

/**
 * dd로 stdin을 단일 read() 시스콜로 즉시 읽는다.
 * Claude Code가 개행 없이 파이프를 오래 열어두므로 cat/read 사용 불가.
 */
function buildScript(port: number): string {
  return `#!/bin/bash
INPUT=$(dd bs=65536 count=1 2>/dev/null)
[ -n "$INPUT" ] && {
  printf '{"panelId":"%s","payload":%s}' "$DECK_PANEL_ID" "$INPUT" | \\
    curl -s --connect-timeout 1 -m 2 \\
      -X POST http://127.0.0.1:${port}/hook/notify \\
      -H 'Content-Type: application/json' \\
      -d @- &>/dev/null
} &
`;
}

/** 훅 스크립트 파일을 생성/갱신한다. */
async function writeScript(port: number): Promise<void> {
  await mkdir(dirname(SCRIPT_PATH), { recursive: true });
  await writeFile(SCRIPT_PATH, buildScript(port), "utf-8");
  await chmod(SCRIPT_PATH, 0o755);
}

type HookEntry = Record<string, unknown>;

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

/** 커맨드 문자열이 DECK 훅인지 확인 */
function isDeckCommand(command: string): boolean {
  return command.includes(DECK_MARKER);
}

/** 항목에 DECK 마커가 있는지 확인 */
function entryHasDeckHook(entry: HookEntry): boolean {
  if (Array.isArray(entry.hooks)) {
    return entry.hooks.some(
      (h: HookEntry) => typeof h.command === "string" && isDeckCommand(h.command),
    );
  }
  if (typeof entry.command === "string") {
    return isDeckCommand(entry.command);
  }
  return false;
}

/** 지정된 이벤트에서 훅 배열과 DECK 존재 여부를 추출 */
function getEventEntries(
  hooks: Record<string, unknown>,
  event: string,
): { entries: HookEntry[]; hasDeck: boolean } {
  const entries = Array.isArray(hooks[event]) ? (hooks[event] as HookEntry[]) : [];
  return { entries, hasDeck: entries.some(entryHasDeckHook) };
}

/** ~/.claude/settings.json에 DECK 훅이 등록되어 있는지 확인 */
export async function checkHook(_port: number): Promise<boolean> {
  const settings = await readSettings();
  const hooks = settings.hooks as Record<string, unknown> | undefined;
  if (!hooks) return false;
  return HOOK_EVENTS.every((event) => getEventEntries(hooks, event).hasDeck);
}

/** DECK 훅을 ~/.claude/settings.json에 등록 */
export async function registerHook(port: number): Promise<void> {
  const settings = await readSettings();

  if (!settings.hooks) settings.hooks = {};
  const hooks = settings.hooks as Record<string, unknown>;

  // 모든 이벤트에서 기존 DECK 항목 제거
  for (const event of HOOK_EVENTS) {
    const { entries } = getEventEntries(hooks, event);
    const filtered = entries.filter((e) => !entryHasDeckHook(e));
    if (filtered.length > 0) {
      hooks[event] = filtered;
    } else {
      delete hooks[event];
    }
  }

  // 스크립트 파일 생성/갱신
  await writeScript(port);

  // 모든 이벤트에 훅 등록
  const hookDef = { hooks: [{ type: "command", command: SCRIPT_PATH }] };
  for (const event of HOOK_EVENTS) {
    const arr = Array.isArray(hooks[event]) ? (hooks[event] as HookEntry[]) : [];
    arr.push({ ...hookDef });
    hooks[event] = arr;
  }

  await writeSettings(settings);
}
