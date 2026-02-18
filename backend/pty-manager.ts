import * as pty from "node-pty";
import type { PtySession } from "./types";

const MAX_SESSIONS = 4;

export type OnDataCallback = (id: string, data: string) => void;
export type OnExitCallback = (id: string, exitCode: number) => void;

const BATCH_INTERVAL = 16; // ~60fps

export class PtyManager {
  private sessions = new Map<string, PtySession>();
  private onData: OnDataCallback;
  private onExit: OnExitCallback;

  // 출력 배칭: 패널별 버퍼를 모아서 16ms마다 flush
  private outputBuffers = new Map<string, string>();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(onData: OnDataCallback, onExit: OnExitCallback) {
    this.onData = onData;
    this.onExit = onExit;
  }

  private bufferOutput(id: string, data: string): void {
    const existing = this.outputBuffers.get(id);
    this.outputBuffers.set(id, existing ? existing + data : data);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBuffers(), BATCH_INTERVAL);
    }
  }

  private flushBuffers(): void {
    this.batchTimer = null;
    for (const [id, data] of this.outputBuffers) {
      this.onData(id, data);
    }
    this.outputBuffers.clear();
  }

  /**
   * 새 PTY 세션 생성.
   * command: 실행할 명령어 (예: 'claude')
   * args: 명령어 인자 (예: ['--model', 'sonnet'])
   * cwd: 작업 디렉토리
   * cols, rows: 터미널 초기 크기
   */
  create(command: string, args: string[], cwd: string, cols: number, rows: number, panelId?: string): string {
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(`최대 ${MAX_SESSIONS}개 세션까지 생성 가능`);
    }

    const id = panelId ?? crypto.randomUUID();
    const shell = pty.spawn(command, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: { ...process.env, DECK_PANEL_ID: id, CLAUDECODE: "" },
    });

    const session: PtySession = { id, pty: shell, command, cwd };
    this.sessions.set(id, session);

    shell.onData((data: string) => {
      this.bufferOutput(id, data);
    });

    shell.onExit(({ exitCode }: { exitCode: number }) => {
      // 남은 버퍼 즉시 flush
      const remaining = this.outputBuffers.get(id);
      if (remaining) {
        this.outputBuffers.delete(id);
        this.onData(id, remaining);
      }
      this.sessions.delete(id);
      this.onExit(id, exitCode);
    });

    return id;
  }

  /** PTY에 데이터 쓰기 (키 입력 전달) */
  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`세션 없음: ${id}`);
    session.pty.write(data);
  }

  /** PTY 크기 변경 */
  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`세션 없음: ${id}`);
    session.pty.resize(cols, rows);
  }

  /** PTY 종료 */
  kill(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return; // 이미 종료된 경우 무시
    session.pty.kill();
    this.sessions.delete(id);
  }

  /** 모든 PTY 종료 (서버 셧다운 시) */
  killAll(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.outputBuffers.clear();
    for (const [, session] of this.sessions) {
      session.pty.kill();
    }
    this.sessions.clear();
  }

  /** 현재 세션 수 */
  get count(): number {
    return this.sessions.size;
  }

  /** 세션 존재 여부 */
  has(id: string): boolean {
    return this.sessions.has(id);
  }
}
