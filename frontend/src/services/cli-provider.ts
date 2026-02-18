// CLI별 옵션 정의와 명령어 조합 로직을 데이터 주도 프로바이더 패턴으로 관리한다.
// 새 CLI를 추가할 때는 프로바이더 정의만 추가하면 UI가 자동 생성된다.

export interface OptionDef {
  key: string;
  label: string;
  type: "radio" | "dropdown" | "checkbox" | "text" | "textarea";
  flag: string;
  choices?: { value: string; label: string }[];
  defaultValue: string | boolean;
  group: "basic" | "advanced";
  placeholder?: string;
}

export interface CLIProvider {
  name: string;
  command: string;
  options: OptionDef[];
  buildCommand: (state: Record<string, unknown>) => string;
  hookSupported: boolean;
}

const claudeCodeOptions: OptionDef[] = [
  // 기본 옵션
  {
    key: "session",
    label: "세션",
    type: "radio",
    flag: "",
    choices: [
      { value: "new", label: "새 세션" },
      { value: "continue", label: "이전 세션 이어하기 (-c)" },
      { value: "resume", label: "특정 세션 선택 (-r)" },
    ],
    defaultValue: "new",
    group: "basic",
  },
  {
    key: "permissionMode",
    label: "권한",
    type: "dropdown",
    flag: "--permission-mode",
    choices: [
      { value: "plan", label: "plan" },
      { value: "safe", label: "safe" },
      { value: "turbo", label: "turbo" },
    ],
    defaultValue: "plan",
    group: "basic",
  },
  {
    key: "skipPermissions",
    label: "--dangerously-skip-permissions",
    type: "checkbox",
    flag: "--dangerously-skip-permissions",
    defaultValue: false,
    group: "basic",
  },
  {
    key: "model",
    label: "모델",
    type: "dropdown",
    flag: "--model",
    choices: [
      { value: "opus", label: "opus" },
      { value: "sonnet", label: "sonnet" },
      { value: "haiku", label: "haiku" },
    ],
    defaultValue: "opus",
    group: "basic",
  },
  // 고급 옵션
  {
    key: "allowedTools",
    label: "허용 도구",
    type: "text",
    flag: "--allowedTools",
    defaultValue: "",
    group: "advanced",
    placeholder: "Bash(git *),Read,Edit",
  },
  {
    key: "disallowedTools",
    label: "비허용 도구",
    type: "text",
    flag: "--disallowedTools",
    defaultValue: "",
    group: "advanced",
    placeholder: "Bash,Write",
  },
  {
    key: "tools",
    label: "도구 제한",
    type: "text",
    flag: "--tools",
    defaultValue: "",
    group: "advanced",
    placeholder: "Read,Grep,Glob",
  },
  {
    key: "addDir",
    label: "추가 디렉토리",
    type: "text",
    flag: "--add-dir",
    defaultValue: "",
    group: "advanced",
    placeholder: "/path/to/other/project",
  },
  {
    key: "appendSystemPrompt",
    label: "시스템 프롬프트 추가",
    type: "textarea",
    flag: "--append-system-prompt",
    defaultValue: "",
    group: "advanced",
    placeholder: "항상 한국어로 응답하세요",
  },
  {
    key: "mcpConfig",
    label: "MCP 설정",
    type: "text",
    flag: "--mcp-config",
    defaultValue: "",
    group: "advanced",
    placeholder: "/path/to/mcp.json",
  },
  {
    key: "agent",
    label: "에이전트",
    type: "text",
    flag: "--agent",
    defaultValue: "",
    group: "advanced",
    placeholder: "agent-name",
  },
  {
    key: "chrome",
    label: "크롬 연동",
    type: "checkbox",
    flag: "--chrome",
    defaultValue: false,
    group: "advanced",
  },
  {
    key: "verbose",
    label: "상세 로그",
    type: "checkbox",
    flag: "--verbose",
    defaultValue: false,
    group: "advanced",
  },
  {
    key: "extraFlags",
    label: "추가 플래그",
    type: "text",
    flag: "",
    defaultValue: "",
    group: "advanced",
    placeholder: "--flag value",
  },
];

function buildClaudeCommand(state: Record<string, unknown>): string {
  const parts = ["claude"];

  // 모델
  const model = (state.model as string) || "opus";
  parts.push("--model", model);

  // 권한 모드
  const perm = (state.permissionMode as string) || "plan";
  parts.push("--permission-mode", perm);

  // 권한 스킵
  if (state.skipPermissions) parts.push("--dangerously-skip-permissions");

  // 세션
  const session = (state.session as string) || "new";
  if (session === "continue") parts.push("-c");
  if (session === "resume") parts.push("-r");

  // 고급 옵션: flag가 있는 text 필드
  for (const opt of claudeCodeOptions) {
    if (opt.group !== "advanced") continue;
    const val = state[opt.key];
    if (!val) continue;

    if (opt.type === "checkbox" && val === true && opt.flag) {
      parts.push(opt.flag);
    } else if (opt.type === "text" || opt.type === "textarea") {
      const str = (val as string).trim();
      if (!str) continue;
      if (opt.flag) {
        parts.push(opt.flag, `"${str}"`);
      } else {
        // extraFlags: 직접 이어붙임
        parts.push(str);
      }
    }
  }

  return parts.join(" ");
}

const customOptions: OptionDef[] = [
  {
    key: "command",
    label: "명령어",
    type: "text",
    flag: "",
    defaultValue: "",
    group: "basic",
    placeholder: "aider --model gpt-4o",
  },
];

function buildCustomCommand(state: Record<string, unknown>): string {
  return ((state.command as string) || "").trim();
}

export const claudeCodeProvider: CLIProvider = {
  name: "Claude Code",
  command: "claude",
  options: claudeCodeOptions,
  buildCommand: buildClaudeCommand,
  hookSupported: true,
};

export const customProvider: CLIProvider = {
  name: "커스텀",
  command: "",
  options: customOptions,
  buildCommand: buildCustomCommand,
  hookSupported: false,
};

const providers: Record<string, CLIProvider> = {
  claude: claudeCodeProvider,
  custom: customProvider,
};

export function getProvider(cli: string): CLIProvider {
  return providers[cli] ?? customProvider;
}

export function getProviderList(): CLIProvider[] {
  return [claudeCodeProvider, customProvider];
}
