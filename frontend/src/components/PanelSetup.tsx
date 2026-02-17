import { useState } from "react";
import { usePanelStore } from "../stores/panel-store";

interface PanelSetupProps {
  panelId: string;
}

type CliType = "claude" | "custom";
type SessionMode = "new" | "continue" | "resume";
type PermissionMode = "plan" | "safe" | "turbo";
type ModelType = "sonnet" | "opus" | "haiku";

export function PanelSetup({ panelId }: PanelSetupProps) {
  const updatePanel = usePanelStore((s) => s.updatePanel);

  const [cliType, setCliType] = useState<CliType>("claude");
  const [path, setPath] = useState("");
  const [sessionMode, setSessionMode] = useState<SessionMode>("new");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("plan");
  const [skipPermissions, _setSkipPermissions] = useState(false);
  const [model, setModel] = useState<ModelType>("sonnet");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customCommand, setCustomCommand] = useState("");

  // Claude Code 명령어 조합
  function buildCommand(): string {
    if (cliType === "custom") return customCommand;

    const parts = ["claude"];
    parts.push("--model", model);
    parts.push("--permission-mode", permissionMode);
    if (skipPermissions) parts.push("--dangerously-skip-permissions");
    if (sessionMode === "continue") parts.push("-c");
    if (sessionMode === "resume") parts.push("-r");
    if (path) parts.push(path);
    return parts.join(" ");
  }

  function handleStart() {
    const name = path ? path.split("/").pop() || "새 패널" : "새 패널";
    const cli = cliType === "claude" ? "claude" : customCommand.split(/\s+/)[0] || "";
    const options =
      cliType === "claude"
        ? buildCommand().replace(/^claude\s*/, "")
        : customCommand.split(/\s+/).slice(1).join(" ");

    updatePanel(panelId, {
      name,
      cli,
      path,
      options,
      status: "active", // Phase 4에서 WebSocket create 메시지 전송 후 전환
    });
  }

  return (
    <div className="p-3 text-xs leading-relaxed space-y-3">
      {/* CLI 탭 */}
      <div className="flex gap-0">
        <button
          onClick={() => setCliType("claude")}
          className={`px-3 py-1.5 text-xs border border-r-0 ${
            cliType === "claude"
              ? "bg-deck-cyan/15 text-deck-cyan border-deck-cyan/40"
              : "bg-deck-bg text-deck-dim border-dashed border-deck-border"
          }`}
        >
          Claude Code
        </button>
        <button
          onClick={() => setCliType("custom")}
          className={`px-3 py-1.5 text-xs border ${
            cliType === "custom"
              ? "bg-deck-cyan/15 text-deck-cyan border-deck-cyan/40"
              : "bg-deck-bg text-deck-dim border-dashed border-deck-border"
          }`}
        >
          커스텀
        </button>
      </div>

      {/* 경로 입력 */}
      <div>
        <div className="text-deck-dim mb-1">▪ 경로</div>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="~/project"
          className="w-full bg-deck-bg border border-dashed border-deck-border px-2 py-1.5 text-deck-text font-term text-xs focus:border-deck-cyan/50 outline-none"
        />
        {/* 자동완성 드롭다운은 Phase 4에서 WebSocket 연동 시 구현 */}
      </div>

      {cliType === "claude" ? (
        <>
          {/* 세션 모드 */}
          <div>
            <div className="text-deck-dim mb-1">
              ▪ 세션{" "}
              <span className="text-deck-border tracking-[0.2em]">·····················</span>
            </div>
            <div className="space-y-1 pl-2">
              {(
                [
                  ["new", "새 세션"],
                  ["continue", "이전 세션 이어하기 (-c)"],
                  ["resume", "특정 세션 선택 (-r)"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 cursor-pointer transition-colors ${
                    sessionMode === value ? "text-deck-cyan" : "text-deck-dim hover:text-deck-cyan"
                  }`}
                  onClick={() => setSessionMode(value)}
                >
                  <span className={sessionMode === value ? "text-deck-cyan" : ""}>
                    {sessionMode === value ? "◆" : "◇"}
                  </span>
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 권한 모드 */}
          <div>
            <div className="text-deck-dim mb-1">
              ▪ 권한{" "}
              <span className="text-deck-border tracking-[0.2em]">·····················</span>
            </div>
            <div className="pl-2 flex items-center gap-2">
              <select
                value={permissionMode}
                onChange={(e) => setPermissionMode(e.target.value as PermissionMode)}
                className="bg-deck-bg border border-dashed border-deck-border px-2 py-1 text-deck-text cursor-pointer hover:border-deck-cyan/50"
              >
                <option value="plan">plan</option>
                <option value="safe">safe</option>
                <option value="turbo">turbo</option>
              </select>
              <span className="text-deck-dim">(plan / safe / turbo)</span>
            </div>
          </div>

          {/* 모델 */}
          <div>
            <div className="text-deck-dim mb-1">
              ▪ 모델{" "}
              <span className="text-deck-border tracking-[0.2em]">·····················</span>
            </div>
            <div className="pl-2 flex items-center gap-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as ModelType)}
                className="bg-deck-bg border border-dashed border-deck-border px-2 py-1 text-deck-text cursor-pointer hover:border-deck-cyan/50"
              >
                <option value="sonnet">sonnet</option>
                <option value="opus">opus</option>
                <option value="haiku">haiku</option>
              </select>
              <span className="text-deck-dim">(sonnet / opus / haiku)</span>
            </div>
          </div>

          {/* 추가 옵션 */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-deck-dim hover:text-deck-cyan transition-colors cursor-pointer text-xs"
            >
              {showAdvanced ? "▾" : "▸"} 추가 옵션
            </button>
            {showAdvanced && (
              <div className="mt-2 pl-2 space-y-2 border-l border-dotted border-deck-border">
                <div className="text-deck-dim">(추가 옵션 필드는 Phase 3+ 에서 구현)</div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* 커스텀 명령어 */
        <div>
          <div className="text-deck-dim mb-1">▪ 명령어</div>
          <input
            type="text"
            value={customCommand}
            onChange={(e) => setCustomCommand(e.target.value)}
            placeholder="aider --model gpt-4o"
            className="w-full bg-deck-bg border border-dashed border-deck-border px-2 py-1.5 text-deck-text font-term text-xs focus:border-deck-cyan/50 outline-none"
          />
        </div>
      )}

      {/* 구분선 */}
      <div className="text-deck-border text-center tracking-[0.3em] text-[10px]">
        · · · · · · · · · · · · · · · · · · · · · · · ·
      </div>

      {/* 명령어 미리보기 */}
      <div className="font-term text-deck-cyan bg-deck-bg/60 px-2 py-1.5 border-l-2 border-deck-cyan">
        <span className="text-deck-dim">▸</span> {buildCommand()}
      </div>

      {/* 시작 버튼 */}
      <div className="flex justify-center pt-1">
        <button
          onClick={handleStart}
          disabled={!path && cliType === "claude"}
          className="bg-deck-cyan text-deck-bg font-bold px-8 py-2 text-sm hover:shadow-[0_0_16px_#39C5BB] transition-shadow cursor-pointer tracking-wide disabled:opacity-30 disabled:cursor-not-allowed"
        >
          시작
        </button>
      </div>
    </div>
  );
}
