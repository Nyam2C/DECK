// ═══════════════════════ 클라이언트 → 서버 ═══════════════════════

export type ClientMessage =
  | { type: "create"; cli: string; path: string; options: string; panelId?: string }
  | { type: "input"; panelId: string; data: string }
  | { type: "resize"; panelId: string; cols: number; rows: number }
  | { type: "kill"; panelId: string }
  | { type: "autocomplete"; partial: string };

// ═══════════════════════ 서버 → 클라이언트 ═══════════════════════

export type ServerMessage =
  | { type: "created"; panelId: string }
  | { type: "output"; panelId: string; data: string }
  | { type: "exited"; panelId: string; exitCode: number }
  | { type: "autocomplete-result"; candidates: string[] }
  | { type: "status"; panelId: string; state: PanelState }
  | { type: "error"; panelId: string; message: string }
  | { type: "hook-notify"; panelId: string; message: string }
  | { type: "hook-status"; panelId: string; connected: boolean };

export type PanelState = "active" | "idle" | "input";

// ═══════════════════════ PTY 세션 ═══════════════════════

export interface PtySession {
  id: string;
  pty: import("node-pty").IPty;
  command: string;
  cwd: string;
}
