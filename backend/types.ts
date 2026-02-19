// ═══════════════════════ 클라이언트 → 서버 ═══════════════════════

export type ClientMessage =
  | { type: "create"; cli: string; path: string; options: string; panelId?: string }
  | { type: "input"; panelId: string; data: string }
  | { type: "resize"; panelId: string; cols: number; rows: number }
  | { type: "kill"; panelId: string }
  | { type: "autocomplete"; panelId: string; partial: string }
  | { type: "register-hook"; panelId: string };

// ═══════════════════════ 서버 → 클라이언트 ═══════════════════════

export type ServerMessage =
  | { type: "created"; panelId: string }
  | { type: "output"; panelId: string; data: string }
  | { type: "exited"; panelId: string; exitCode: number }
  | { type: "autocomplete-result"; panelId: string; candidates: string[] }
  | { type: "status"; panelId: string; state: PanelState }
  | { type: "error"; panelId: string; message: string }
  | { type: "hook-notify"; panelId: string; message: string }
  | { type: "hook-status"; panelId: string; connected: boolean }
  | { type: "restore-session"; panels: PresetPanel[] };

export type PanelState = "active" | "idle" | "input";

// ═══════════════════════ PTY 세션 ═══════════════════════

export interface PtySession {
  id: string;
  pty: import("node-pty").IPty;
  command: string;
  cwd: string;
  /** 원본 CLI 이름 (예: 'claude') */
  cli: string;
  /** 원본 옵션 문자열 (예: '--model sonnet') */
  options: string;
}

// ═══════════════════════ 프리셋 / 세션 ═══════════════════════

export interface PresetPanel {
  cli: string;
  path: string;
  options: string;
}

export interface Preset {
  name: string;
  panels: PresetPanel[];
  createdAt: string;
}

export interface SessionState {
  panels: PresetPanel[];
  updatedAt: string;
}
