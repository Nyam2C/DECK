import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Preset, PresetPanel, SessionState } from "./types";
import { isWindows, getWslHomedir, wslExec } from "./wsl";

const DECK_DIR = join(homedir(), ".deck");

/** ~/.deck 디렉토리 보장 */
async function ensureDeckDir(dir: string = DECK_DIR): Promise<void> {
  await mkdir(dir, { recursive: true });
}

// 테스트용: 경로를 오버라이드할 수 있도록 팩토리 함수로 내보냄
export function createSessionManager(basePath: string = DECK_DIR) {
  const presetsFile = join(basePath, "presets.json");
  const sessionFile = join(basePath, "session.json");

  async function loadPresets(): Promise<Preset[]> {
    try {
      const data = await readFile(presetsFile, "utf-8");
      return JSON.parse(data) as Preset[];
    } catch {
      return [];
    }
  }

  async function savePreset(preset: Preset): Promise<void> {
    await ensureDeckDir(basePath);
    const presets = await loadPresets();
    const index = presets.findIndex((p) => p.name === preset.name);
    if (index >= 0) {
      presets[index] = preset;
    } else {
      presets.push(preset);
    }
    await writeFile(presetsFile, JSON.stringify(presets, null, 2));
  }

  async function deletePreset(name: string): Promise<void> {
    const presets = await loadPresets();
    const filtered = presets.filter((p) => p.name !== name);
    await ensureDeckDir(basePath);
    await writeFile(presetsFile, JSON.stringify(filtered, null, 2));
  }

  async function updatePreset(originalName: string, preset: Preset): Promise<void> {
    await ensureDeckDir(basePath);
    const presets = await loadPresets();
    const index = presets.findIndex((p) => p.name === originalName);
    if (index < 0) {
      presets.push(preset);
    } else {
      presets[index] = preset;
    }
    await writeFile(presetsFile, JSON.stringify(presets, null, 2));
  }

  async function loadSession(): Promise<SessionState | null> {
    try {
      const data = await readFile(sessionFile, "utf-8");
      return JSON.parse(data) as SessionState;
    } catch {
      return null;
    }
  }

  async function saveSession(panels: PresetPanel[]): Promise<void> {
    await ensureDeckDir(basePath);
    const state: SessionState = { panels, updatedAt: new Date().toISOString() };
    await writeFile(sessionFile, JSON.stringify(state, null, 2));
  }

  return { loadPresets, savePreset, deletePreset, updatePreset, loadSession, saveSession };
}

// 기본 인스턴스 (프로덕션용)
const defaultManager = createSessionManager();
export const { loadPresets, savePreset, deletePreset, updatePreset, loadSession, saveSession } =
  defaultManager;

/**
 * 지정된 작업 경로에 Claude 대화 기록(.jsonl)이 존재하는지 확인한다.
 * Claude는 ~/.claude/projects/<encoded-path>/ 에 대화를 저장한다.
 * 경로 인코딩: [a-zA-Z0-9._-] 이외의 모든 문자를 '-'로 치환.
 */
export async function hasClaudeConversations(cwd: string): Promise<boolean> {
  const encoded = cwd.replace(/[^a-zA-Z0-9._-]/g, "-");

  if (isWindows) {
    try {
      const wslHome = getWslHomedir();
      const projectDir = `${wslHome}/.claude/projects/${encoded}`;
      const output = await wslExec(`ls '${projectDir.replace(/'/g, "'\\''")}'`);
      return output.split("\n").some((e) => e.endsWith(".jsonl"));
    } catch {
      return false;
    }
  }

  const projectDir = join(homedir(), ".claude", "projects", encoded);
  try {
    const entries = await readdir(projectDir);
    return entries.some((e) => e.endsWith(".jsonl"));
  } catch {
    return false;
  }
}
