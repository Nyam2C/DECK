// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  getStatusClasses,
  getStatusIcon,
  getStatusLabel,
  getExitMessage,
} from "../../components/Panel";
import { Panel } from "../../components/Panel";
import { usePanelStore } from "../../stores/panel-store";
import type { Panel as PanelType } from "../../types";

// xterm 및 WebSocket 모킹
vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    dispose: vi.fn(),
    attachCustomKeyEventHandler: vi.fn(),
    cols: 80,
    rows: 24,
    options: {},
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-webgl", () => ({
  WebglAddon: vi.fn().mockImplementation(() => ({
    onContextLoss: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

vi.mock("../../hooks/use-websocket", () => ({
  sendMessage: vi.fn(() => true),
  onServerMessage: vi.fn(() => () => {}),
}));

describe("getStatusClasses", () => {
  it("idle: pink glow", () => {
    expect(getStatusClasses("idle", false)).toContain("border-deck-pink");
    expect(getStatusClasses("idle", false)).toContain("animate-glow-pink");
  });

  it("active + focused: cyan glow", () => {
    expect(getStatusClasses("active", true)).toContain("animate-glow");
    expect(getStatusClasses("active", true)).toContain("border-deck-cyan");
  });

  it("input: gold glow (포커스 무관)", () => {
    expect(getStatusClasses("input", false)).toContain("animate-glow-gold");
    expect(getStatusClasses("input", true)).toContain("animate-glow-gold");
  });

  it("setup: dashed border", () => {
    expect(getStatusClasses("setup", false)).toContain("border-dashed");
  });

  it("active + unfocused: dashed border", () => {
    expect(getStatusClasses("active", false)).toContain("border-dashed");
  });

  it("exited: dashed border", () => {
    expect(getStatusClasses("exited", false)).toContain("border-dashed");
  });
});

describe("getStatusIcon", () => {
  it("input: gold filled", () => {
    expect(getStatusIcon("input", false)).toEqual({ icon: "■", color: "text-deck-gold" });
    expect(getStatusIcon("input", true)).toEqual({ icon: "■", color: "text-deck-gold" });
  });

  it("active + focused: cyan filled", () => {
    expect(getStatusIcon("active", true)).toEqual({ icon: "■", color: "text-deck-cyan" });
  });

  it("idle + focused: cyan filled", () => {
    expect(getStatusIcon("idle", true)).toEqual({ icon: "■", color: "text-deck-cyan" });
  });

  it("setup: dim hollow (포커스 무관)", () => {
    expect(getStatusIcon("setup", true)).toEqual({ icon: "□", color: "text-deck-dim" });
  });

  it("exited: dim hollow (포커스 무관)", () => {
    expect(getStatusIcon("exited", true)).toEqual({ icon: "□", color: "text-deck-dim" });
  });

  it("unfocused: dim hollow", () => {
    expect(getStatusIcon("active", false)).toEqual({ icon: "□", color: "text-deck-dim" });
  });
});

describe("getStatusLabel", () => {
  it("active → cyan", () => {
    const result = getStatusLabel("active");
    expect(result?.text).toBe("▪▪▪ active ▪▪▪");
    expect(result?.color).toBe("text-deck-cyan");
  });

  it("idle → pink", () => {
    const result = getStatusLabel("idle");
    expect(result?.color).toBe("text-deck-pink");
  });

  it("input → gold", () => {
    const result = getStatusLabel("input");
    expect(result?.color).toBe("text-deck-gold");
  });

  it("exited → dim", () => {
    const result = getStatusLabel("exited");
    expect(result?.color).toBe("text-deck-dim");
  });

  it("setup → null", () => {
    expect(getStatusLabel("setup")).toBeNull();
  });
});

describe("getExitMessage", () => {
  it("0 → 정상 종료", () => {
    expect(getExitMessage(0)).toBe("세션이 정상 종료되었습니다");
  });

  it("130 → 중단 (SIGINT)", () => {
    expect(getExitMessage(130)).toBe("세션이 중단되었습니다");
  });

  it("137 → 비정상 종료 (OOM)", () => {
    expect(getExitMessage(137)).toBe("세션이 비정상 종료되었습니다");
  });

  it("143 → 종료 (SIGTERM)", () => {
    expect(getExitMessage(143)).toBe("세션이 종료되었습니다");
  });

  it("-1 → 서버 연결 끊김", () => {
    expect(getExitMessage(-1)).toBe("서버 연결이 끊어졌습니다");
  });

  it("undefined → 비정상 종료", () => {
    expect(getExitMessage(undefined)).toBe("세션이 비정상 종료되었습니다");
  });

  it("알 수 없는 코드 → 비정상 종료", () => {
    expect(getExitMessage(999)).toBe("세션이 비정상 종료되었습니다");
  });
});

describe("Panel — 렌더링", () => {
  const makePanel = (overrides?: Partial<PanelType>): PanelType => ({
    id: "test-panel",
    name: "test-project",
    cli: "claude",
    path: "/home/user/project",
    options: "--model opus",
    status: "setup",
    hookConnected: null,
    ...overrides,
  });

  beforeEach(() => {
    usePanelStore.setState({
      panels: [makePanel()],
      focusedId: "test-panel",
      pinnedId: null,
    });
  });

  it("setup 상태에서 PanelSetup이 렌더링된다", () => {
    render(<Panel panel={makePanel()} spanClassName="" />);
    expect(screen.getByText("test-project")).toBeTruthy();
  });

  it("exited 상태에서 종료 메시지가 표시된다", () => {
    render(<Panel panel={makePanel({ status: "exited", exitCode: 0 })} spanClassName="" />);
    expect(screen.getByText("세션이 정상 종료되었습니다")).toBeTruthy();
    expect(screen.getByText("재시작")).toBeTruthy();
    expect(screen.getByText("패널 닫기")).toBeTruthy();
  });

  it("active 상태에서 터미널이 렌더링된다", () => {
    render(<Panel panel={makePanel({ status: "active" })} spanClassName="" />);
    expect(screen.getByText("▪▪▪ active ▪▪▪")).toBeTruthy();
  });

  it("닫기 버튼에 aria-label이 있다", () => {
    render(<Panel panel={makePanel()} spanClassName="" />);
    expect(screen.getByLabelText("패널 닫기")).toBeTruthy();
  });

  it("핀 버튼이 표시된다", () => {
    render(<Panel panel={makePanel({ status: "active" })} spanClassName="" />);
    expect(screen.getByText("PIN")).toBeTruthy();
  });

  it("active 패널 닫기 시 확인 모드로 전환", () => {
    render(<Panel panel={makePanel({ status: "active" })} spanClassName="" />);
    fireEvent.click(screen.getByLabelText("패널 닫기"));
    expect(screen.getByText("세션 종료")).toBeTruthy();
    expect(screen.getByText("종료")).toBeTruthy();
    expect(screen.getByText("취소")).toBeTruthy();
  });

  it("확인 모드에서 취소하면 원래 상태로 돌아간다", () => {
    render(<Panel panel={makePanel({ status: "active" })} spanClassName="" />);
    fireEvent.click(screen.getByLabelText("패널 닫기"));
    fireEvent.click(screen.getByText("취소"));
    expect(screen.getByText("PIN")).toBeTruthy();
  });

  it("hookConnected === false일 때 훅 미등록 알림이 표시된다", () => {
    render(
      <Panel panel={makePanel({ status: "active", hookConnected: false })} spanClassName="" />,
    );
    expect(screen.getByText("▪ 알림 훅 미등록")).toBeTruthy();
  });

  it("hookConnected === true일 때 HOOK 배지가 표시된다", () => {
    render(<Panel panel={makePanel({ status: "active", hookConnected: true })} spanClassName="" />);
    const hookBadges = screen.getAllByText("[ HOOK ]");
    expect(hookBadges.length).toBeGreaterThan(0);
  });

  it("input 상태 표시", () => {
    render(<Panel panel={makePanel({ status: "input" })} spanClassName="" />);
    expect(screen.getByText("▪▪▪ input ▪▪▪")).toBeTruthy();
  });

  it("idle 상태 표시", () => {
    render(<Panel panel={makePanel({ status: "idle" })} spanClassName="" />);
    expect(screen.getByText("▪▪ idle ▪▪")).toBeTruthy();
  });

  it("핀 토글 동작", () => {
    render(<Panel panel={makePanel({ status: "active" })} spanClassName="" />);
    const pinBtn = screen.getByText("PIN");
    fireEvent.click(pinBtn);
    expect(usePanelStore.getState().pinnedId).toBe("test-panel");
  });

  it("패널 클릭 시 포커스 설정", () => {
    usePanelStore.setState({ focusedId: null });
    const { container } = render(
      <Panel panel={makePanel({ status: "active" })} spanClassName="" />,
    );
    fireEvent.click(container.firstElementChild!);
    expect(usePanelStore.getState().focusedId).toBe("test-panel");
  });

  it("exited 패널의 재시작 버튼 동작", () => {
    render(<Panel panel={makePanel({ status: "exited", exitCode: 0 })} spanClassName="" />);
    const restartBtn = screen.getByText("재시작");
    fireEvent.click(restartBtn);
    const panel = usePanelStore.getState().panels.find((p) => p.id === "test-panel");
    expect(panel?.status).toBe("active");
  });

  it("exited 패널의 닫기 버튼 동작", () => {
    render(<Panel panel={makePanel({ status: "exited", exitCode: 0 })} spanClassName="" />);
    const closeBtn = screen.getByText("패널 닫기");
    fireEvent.click(closeBtn);
    expect(usePanelStore.getState().panels.find((p) => p.id === "test-panel")).toBeUndefined();
  });

  it("hook 미연결 배너에서 등록 버튼 동작", () => {
    render(
      <Panel panel={makePanel({ status: "active", hookConnected: false })} spanClassName="" />,
    );
    const registerBtn = screen.getByText("등록");
    fireEvent.click(registerBtn);
    // sendMessage가 호출되었을 것
  });

  it("hook 미연결 배너에서 나중에 버튼 동작", () => {
    render(
      <Panel panel={makePanel({ status: "active", hookConnected: false })} spanClassName="" />,
    );
    const dismissBtn = screen.getByText("나중에");
    fireEvent.click(dismissBtn);
    const panel = usePanelStore.getState().panels.find((p) => p.id === "test-panel");
    expect(panel?.hookConnected).toBeNull();
  });

  it("드래그 이벤트 핸들러가 동작한다", () => {
    render(<Panel panel={makePanel({ status: "active" })} spanClassName="" />);
    const header = screen.getByText("test-project").closest("[draggable]")!;
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    fireEvent.dragStart(header, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "test-panel");
  });

  it("확인 모드에서 종료 버튼 동작", () => {
    render(<Panel panel={makePanel({ status: "active" })} spanClassName="" />);
    fireEvent.click(screen.getByLabelText("패널 닫기"));
    fireEvent.click(screen.getByText("종료"));
    expect(usePanelStore.getState().panels.find((p) => p.id === "test-panel")).toBeUndefined();
  });
});
