import { useState, useEffect, useRef, useCallback } from "react";
import { usePanelStore } from "../stores/panel-store";
import { sendMessage, onServerMessage } from "../hooks/use-websocket";
import { getProvider, getProviderList } from "../services/cli-provider";
import type { OptionDef, CLIProvider } from "../services/cli-provider";

interface PanelSetupProps {
  panelId: string;
}

type CliKey = "claude" | "custom";

/** 프로바이더의 defaultValue로 초기 상태를 구성한다. */
function buildDefaults(provider: CLIProvider): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const opt of provider.options) {
    state[opt.key] = opt.defaultValue;
  }
  return state;
}

export function PanelSetup({ panelId }: PanelSetupProps) {
  const updatePanel = usePanelStore((s) => s.updatePanel);

  const [cliKey, setCliKey] = useState<CliKey>("claude");
  const [path, setPath] = useState("");
  const [formState, setFormState] = useState<Record<string, unknown>>(() =>
    buildDefaults(getProvider("claude")),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // 디렉토리 자동완성
  const [candidates, setCandidates] = useState<string[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  const provider = getProvider(cliKey);

  // CLI 탭 전환 시 폼 상태 초기화
  function switchCli(key: CliKey) {
    setCliKey(key);
    setFormState(buildDefaults(getProvider(key)));
    setShowAdvanced(false);
    setError(null);
  }

  // 폼 필드 업데이트
  function setField(key: string, value: unknown) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  // 서버 응답 구독: error → setup으로 롤백
  useEffect(() => {
    return onServerMessage((msg) => {
      if (msg.type === "error" && msg.panelId === panelId) {
        setStarting(false);
        setError(msg.message);
        updatePanel(panelId, { status: "setup" });
      }
    });
  }, [panelId, updatePanel]);

  // 자동완성 응답 구독 (이 패널의 응답만 처리)
  useEffect(() => {
    return onServerMessage((msg) => {
      if (msg.type === "autocomplete-result" && msg.panelId === panelId) {
        setCandidates(msg.candidates);
        setShowCandidates(msg.candidates.length > 0);
        setSelectedIndex(-1);
      }
    });
  }, [panelId]);

  // 경로 입력 시 디렉토리 자동완성 (debounce 300ms)
  const handlePathChange = useCallback(
    (value: string) => {
      setPath(value);
      setError(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length >= 2) {
        debounceRef.current = setTimeout(() => {
          sendMessage({ type: "autocomplete", panelId, partial: value });
        }, 300);
      } else {
        setCandidates([]);
        setShowCandidates(false);
      }
    },
    [],
  );

  // 자동완성 후보 선택
  function selectCandidate(value: string) {
    setPath(value);
    setShowCandidates(false);
    setCandidates([]);
    setSelectedIndex(-1);
  }

  // 경로 입력 키보드 핸들러
  function handlePathKeyDown(e: React.KeyboardEvent) {
    if (!showCandidates || candidates.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : candidates.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      selectCandidate(candidates[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowCandidates(false);
      setSelectedIndex(-1);
    }
  }

  // 명령어 미리보기 조합
  function previewCommand(): string {
    const cmd = provider.buildCommand(formState);
    if (path) return `${cmd} ${path}`;
    return cmd;
  }

  // 유효성 검증
  function validate(): string | null {
    if (!path.trim()) return "경로를 입력하세요";
    if (cliKey === "custom") {
      const cmd = (formState.command as string) || "";
      if (!cmd.trim()) return "명령어를 입력하세요";
    }
    return null;
  }

  function handleStart() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedPath = path.trim();
    const name = trimmedPath.split("/").pop() || "새 패널";
    const cli = cliKey === "claude" ? "claude" : (formState.command as string).split(/\s+/)[0] || "";
    const cmd = provider.buildCommand(formState);
    const options = cliKey === "claude" ? cmd.replace(/^claude\s*/, "") : cmd.split(/\s+/).slice(1).join(" ");

    setError(null);
    setStarting(true);

    const sent = sendMessage({ type: "create", panelId, cli, path: trimmedPath, options });
    if (!sent) {
      setStarting(false);
      setError("서버에 연결되지 않았습니다");
      return;
    }

    updatePanel(panelId, { name, cli, path: trimmedPath, options, status: "active" });
  }

  // 옵션 렌더링
  function renderOption(opt: OptionDef) {
    const value = formState[opt.key];

    switch (opt.type) {
      case "radio":
        return (
          <div key={opt.key}>
            <div className="text-deck-dim mb-1">
              {"\u25AA"} {opt.label}{" "}
              <span className="text-deck-border tracking-[0.2em]">{"\u00B7".repeat(21)}</span>
            </div>
            <div className="space-y-1 pl-2">
              {opt.choices!.map((c) => (
                <label
                  key={c.value}
                  className={`flex items-center gap-2 cursor-pointer transition-colors ${
                    value === c.value ? "text-deck-cyan" : "text-deck-dim hover:text-deck-cyan"
                  }`}
                  onClick={() => setField(opt.key, c.value)}
                >
                  <span>{value === c.value ? "\u25C6" : "\u25C7"}</span>
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        );

      case "dropdown":
        return (
          <div key={opt.key}>
            <div className="text-deck-dim mb-1">
              {"\u25AA"} {opt.label}{" "}
              <span className="text-deck-border tracking-[0.2em]">{"\u00B7".repeat(21)}</span>
            </div>
            <div className="pl-2 flex items-center gap-2">
              <select
                value={value as string}
                onChange={(e) => setField(opt.key, e.target.value)}
                className="bg-deck-bg border border-dashed border-deck-border px-2 py-1 text-deck-text cursor-pointer hover:border-deck-cyan/50"
              >
                {opt.choices!.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="text-deck-dim">
                ({opt.choices!.map((c) => c.label).join(" / ")})
              </span>
            </div>
          </div>
        );

      case "checkbox":
        return (
          <label
            key={opt.key}
            className={`pl-2 flex items-center gap-2 cursor-pointer transition-colors ${
              value ? "text-deck-gold" : "text-deck-dim hover:text-deck-gold"
            }`}
            onClick={() => setField(opt.key, !value)}
          >
            <span>{value ? "\u25C6" : "\u25C7"}</span>
            {opt.label}
          </label>
        );

      case "text":
        return (
          <div key={opt.key}>
            <div className="text-deck-dim mb-1">{"\u25AA"} {opt.label}</div>
            <input
              type="text"
              value={(value as string) || ""}
              onChange={(e) => setField(opt.key, e.target.value)}
              placeholder={opt.placeholder}
              className="w-full bg-deck-bg border border-dashed border-deck-border px-2 py-1.5 text-deck-text font-term text-xs focus:border-deck-cyan/50 outline-none"
            />
          </div>
        );

      case "textarea":
        return (
          <div key={opt.key}>
            <div className="text-deck-dim mb-1">{"\u25AA"} {opt.label}</div>
            <textarea
              value={(value as string) || ""}
              onChange={(e) => setField(opt.key, e.target.value)}
              placeholder={opt.placeholder}
              rows={3}
              className="w-full bg-deck-bg border border-dashed border-deck-border px-2 py-1.5 text-deck-text font-term text-xs focus:border-deck-cyan/50 outline-none resize-y"
            />
          </div>
        );
    }
  }

  const basicOptions = provider.options.filter((o) => o.group === "basic");
  const advancedOptions = provider.options.filter((o) => o.group === "advanced");
  const providerList = getProviderList();

  return (
    <div className="p-3 text-xs leading-relaxed space-y-3">
      {/* CLI 탭 */}
      <div className="flex gap-0">
        {providerList.map((p, i) => {
          const key = p.command === "claude" ? "claude" : "custom";
          const isLast = i === providerList.length - 1;
          return (
            <button
              key={key}
              onClick={() => switchCli(key as CliKey)}
              className={`px-3 py-1.5 text-xs border ${!isLast ? "border-r-0" : ""} ${
                cliKey === key
                  ? "bg-deck-cyan/15 text-deck-cyan border-deck-cyan/40"
                  : "bg-deck-bg text-deck-dim border-dashed border-deck-border"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* 경로 입력 + 자동완성 */}
      <div className="relative">
        <div className="text-deck-dim mb-1">{"\u25AA"} 경로</div>
        <input
          ref={pathInputRef}
          type="text"
          value={path}
          onChange={(e) => handlePathChange(e.target.value)}
          onKeyDown={handlePathKeyDown}
          onBlur={() => setTimeout(() => setShowCandidates(false), 150)}
          placeholder="~/project"
          className="w-full bg-deck-bg border border-dashed border-deck-border px-2 py-1.5 text-deck-text font-term text-xs focus:border-deck-cyan/50 outline-none"
        />
        {showCandidates && candidates.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-0.5 bg-deck-bg border border-deck-border max-h-32 overflow-y-auto">
            {candidates.map((c, i) => (
              <button
                key={c}
                className={`block w-full text-left px-2 py-1 text-xs font-term ${
                  i === selectedIndex
                    ? "bg-deck-cyan/15 text-deck-cyan"
                    : "text-deck-text hover:bg-deck-cyan/15 hover:text-deck-cyan"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCandidate(c);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 기본 옵션 */}
      {basicOptions.map(renderOption)}

      {/* 고급 옵션 (있을 때만) */}
      {advancedOptions.length > 0 && (
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-deck-dim hover:text-deck-cyan transition-colors cursor-pointer text-xs"
          >
            {showAdvanced ? "\u25BE" : "\u25B8"} 추가 옵션
          </button>
          {showAdvanced && (
            <div className="mt-2 pl-2 space-y-2 border-l border-dotted border-deck-border">
              {advancedOptions.map(renderOption)}
            </div>
          )}
        </div>
      )}

      {/* 구분선 */}
      <div className="text-deck-border text-center tracking-[0.3em] text-[10px]">
        {"\u00B7 ".repeat(24).trim()}
      </div>

      {/* 명령어 미리보기 */}
      <div className="font-term text-deck-cyan bg-deck-bg/60 px-2 py-1.5 border-l-2 border-deck-cyan">
        <span className="text-deck-dim">{"\u25B8"}</span> {previewCommand()}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/30 px-2 py-1.5">
          {error}
        </div>
      )}

      {/* 시작 버튼 */}
      <div className="flex justify-center pt-1">
        <button
          onClick={handleStart}
          disabled={starting}
          className="bg-deck-cyan text-deck-bg font-bold px-8 py-2 text-sm hover:shadow-[0_0_16px_#39C5BB] transition-shadow cursor-pointer tracking-wide disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {starting ? "연결 중..." : "시작"}
        </button>
      </div>
    </div>
  );
}
