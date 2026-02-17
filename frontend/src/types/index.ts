/** 패널 상태 */
export type PanelStatus = "setup" | "active" | "idle" | "input" | "exited";

/** 패널 데이터 */
export interface Panel {
  id: string;
  /** 프로젝트 이름 (경로의 마지막 세그먼트) */
  name: string;
  /** CLI 명령어 (예: 'claude', 'aider') */
  cli: string;
  /** 작업 디렉토리 */
  path: string;
  /** CLI 실행 옵션 문자열 */
  options: string;
  /** 현재 상태 */
  status: PanelStatus;
  /** 훅 연동 상태 */
  hookConnected: boolean | null; // null: 훅 미지원 CLI
  /** PTY 종료 코드 (exited 상태에서만 유효) */
  exitCode?: number;
}

/** 설정값 */
export interface Settings {
  fontSize: number;
  theme: string;
  startBehavior: "empty" | "restore";
  port: number;
  scrollback: number;
  leaderKey: string;
}

/** 기본 설정값 */
export const DEFAULT_SETTINGS: Settings = {
  fontSize: 14,
  theme: "dark",
  startBehavior: "empty",
  port: 3000,
  scrollback: 5000,
  leaderKey: "Ctrl+Space",
};
