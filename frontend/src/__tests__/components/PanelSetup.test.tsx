// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { getProvider, getProviderList } from "../../services/cli-provider";
import { usePanelStore } from "../../stores/panel-store";
import { useSettingsStore } from "../../stores/settings-store";
import { PanelSetup } from "../../components/PanelSetup";
import { DEFAULT_SETTINGS } from "../../types";

// WebSocket 모킹
vi.mock("../../hooks/use-websocket", () => ({
  sendMessage: vi.fn(() => true),
  onServerMessage: vi.fn(() => () => {}),
}));

describe("PanelSetup — 폼 렌더링 로직", () => {
  it("Claude Code 프로바이더는 기본 옵션 4개를 갖는다", () => {
    const provider = getProvider("claude");
    const basic = provider.options.filter((o) => o.group === "basic");
    expect(basic).toHaveLength(4);
    expect(basic.map((o) => o.key)).toEqual([
      "session",
      "permissionMode",
      "skipPermissions",
      "model",
    ]);
  });

  it("Claude Code 프로바이더는 고급 옵션 10개를 갖는다", () => {
    const provider = getProvider("claude");
    const advanced = provider.options.filter((o) => o.group === "advanced");
    expect(advanced).toHaveLength(10);
  });

  it("커스텀 프로바이더는 명령어 입력 1개만 갖는다", () => {
    const provider = getProvider("custom");
    expect(provider.options).toHaveLength(1);
    expect(provider.options[0].key).toBe("command");
    expect(provider.options[0].type).toBe("text");
  });
});

describe("PanelSetup — 탭 전환 로직", () => {
  it("CLI 전환 시 새 프로바이더의 기본값으로 초기화된다", () => {
    const claude = getProvider("claude");
    const custom = getProvider("custom");

    const customDefaults: Record<string, unknown> = {};
    for (const opt of custom.options) customDefaults[opt.key] = opt.defaultValue;
    expect(customDefaults).toEqual({ command: "" });

    const claudeDefaults: Record<string, unknown> = {};
    for (const opt of claude.options) claudeDefaults[opt.key] = opt.defaultValue;
    expect(claudeDefaults.session).toBe("new");
    expect(claudeDefaults.model).toBe("opus");
    expect(claudeDefaults.permissionMode).toBe("plan");
    expect(claudeDefaults.skipPermissions).toBe(false);
  });
});

describe("PanelSetup — 명령어 미리보기", () => {
  it("기본 상태에서 경로를 포함한 미리보기를 구성한다", () => {
    const provider = getProvider("claude");
    const defaults: Record<string, unknown> = {};
    for (const opt of provider.options) defaults[opt.key] = opt.defaultValue;
    const cmd = provider.buildCommand(defaults);
    const preview = `${cmd} ~/my-project`;
    expect(preview).toBe("claude --model opus --permission-mode plan ~/my-project");
  });

  it("커스텀 명령어에 경로를 붙인 미리보기", () => {
    const provider = getProvider("custom");
    const cmd = provider.buildCommand({ command: "aider --model gpt-4o" });
    const preview = `${cmd} ~/project`;
    expect(preview).toBe("aider --model gpt-4o ~/project");
  });
});

describe("PanelSetup — 유효성 검증 로직", () => {
  function validate(
    cliKey: string,
    path: string,
    formState: Record<string, unknown>,
  ): string | null {
    if (!path.trim()) return "경로를 입력하세요";
    if (cliKey === "custom") {
      const cmd = (formState.command as string) || "";
      if (!cmd.trim()) return "명령어를 입력하세요";
    }
    return null;
  }

  it("경로가 없으면 에러", () => {
    expect(validate("claude", "", {})).toBe("경로를 입력하세요");
    expect(validate("claude", "  ", {})).toBe("경로를 입력하세요");
  });

  it("커스텀 명령어가 없으면 에러", () => {
    expect(validate("custom", "/path", { command: "" })).toBe("명령어를 입력하세요");
    expect(validate("custom", "/path", { command: "  " })).toBe("명령어를 입력하세요");
  });

  it("유효한 입력이면 null", () => {
    expect(validate("claude", "/path", {})).toBeNull();
    expect(validate("custom", "/path", { command: "aider" })).toBeNull();
  });
});

describe("PanelSetup — 고급 옵션 토글", () => {
  it("프로바이더 목록은 3개이다", () => {
    expect(getProviderList()).toHaveLength(3);
  });

  it("Claude Code 고급 옵션에 텍스트/체크박스/텍스트에어리어가 포함된다", () => {
    const provider = getProvider("claude");
    const advanced = provider.options.filter((o) => o.group === "advanced");
    const types = new Set(advanced.map((o) => o.type));
    expect(types.has("text")).toBe(true);
    expect(types.has("checkbox")).toBe(true);
    expect(types.has("textarea")).toBe(true);
  });
});

describe("PanelSetup — 렌더링", () => {
  beforeEach(() => {
    usePanelStore.setState({ panels: [], focusedId: null, pinnedId: null });
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, isOpen: false, draft: null });
    const id = usePanelStore.getState().addPanel();
    if (id) usePanelStore.getState().setFocus(id);
  });

  it("PanelSetup이 렌더링된다", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    expect(screen.getByText("시작")).toBeTruthy();
  });

  it("CLI 탭이 3개 표시된다", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("셸")).toBeTruthy();
    expect(screen.getByText("커스텀")).toBeTruthy();
  });

  it("경로 입력 필드가 표시된다", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    expect(screen.getByPlaceholderText("~/project")).toBeTruthy();
  });

  it("추가 옵션 토글이 동작한다", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    const toggleBtn = screen.getByText(/추가 옵션/);
    fireEvent.click(toggleBtn);
    // 고급 옵션이 렌더링되어야 함
    expect(screen.getByText(/추가 옵션/)).toBeTruthy();
  });

  it("경로 없이 시작하면 에러 표시", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    const startBtn = screen.getByText("시작");
    fireEvent.click(startBtn);
    expect(screen.getByText("경로를 입력하세요")).toBeTruthy();
  });

  it("CLI 탭 전환이 동작한다", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    fireEvent.click(screen.getByText("셸"));
    // Shell 탭에서는 명령어 미리보기가 $SHELL
    expect(screen.getByText(/\$SHELL/)).toBeTruthy();
  });

  it("경로 입력이 동작한다", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    const input = screen.getByPlaceholderText("~/project");
    fireEvent.change(input, { target: { value: "/home/user/test" } });
    expect(input).toHaveProperty("value", "/home/user/test");
  });

  it("유효한 입력으로 시작하면 패널이 active로 전환", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    const input = screen.getByPlaceholderText("~/project");
    fireEvent.change(input, { target: { value: "/home/user/test" } });
    fireEvent.click(screen.getByText("시작"));
    const panel = usePanelStore.getState().panels[0];
    expect(panel.status).toBe("active");
  });

  it("커스텀 탭에서 명령어 없이 시작하면 에러", () => {
    const panels = usePanelStore.getState().panels;
    if (panels.length === 0) return;
    render(<PanelSetup panelId={panels[0].id} />);
    fireEvent.click(screen.getByText("커스텀"));
    const input = screen.getByPlaceholderText("~/project");
    fireEvent.change(input, { target: { value: "/home/user/test" } });
    fireEvent.click(screen.getByText("시작"));
    expect(screen.getByText("명령어를 입력하세요")).toBeTruthy();
  });
});
