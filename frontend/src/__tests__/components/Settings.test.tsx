// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useSettingsStore } from "../../stores/settings-store";
import { DEFAULT_SETTINGS } from "../../types";
import { Settings } from "../../components/Settings";

// WebSocket 모킹
vi.mock("../../hooks/use-websocket", () => ({
  sendMessage: vi.fn(),
  onServerMessage: vi.fn(() => () => {}),
}));

// fetch 모킹 (프리셋 API)
globalThis.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve([]),
}) as unknown as typeof fetch;

describe("Settings 스토어 연동", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isOpen: false,
      draft: null,
    });
  });

  it("설정 모달 열기/닫기 토글", () => {
    expect(useSettingsStore.getState().isOpen).toBe(false);
    useSettingsStore.getState().openSettings();
    expect(useSettingsStore.getState().isOpen).toBe(true);
    useSettingsStore.getState().closeSettings();
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it("GeneralTab에서 사용하는 설정값이 올바르게 업데이트된다", () => {
    const updates = {
      fontSize: 16,
      defaultPath: "/home/user/projects",
      startBehavior: "restore" as const,
      port: 4000,
      scrollback: 10000,
    };
    useSettingsStore.getState().updateSettings(updates);

    const state = useSettingsStore.getState();
    expect(state.fontSize).toBe(16);
    expect(state.defaultPath).toBe("/home/user/projects");
    expect(state.startBehavior).toBe("restore");
    expect(state.port).toBe(4000);
    expect(state.scrollback).toBe(10000);
  });

  it("부분 업데이트가 기존 값을 유지한다", () => {
    useSettingsStore.getState().updateSettings({ fontSize: 20 });
    useSettingsStore.getState().updateSettings({ port: 9090 });

    const state = useSettingsStore.getState();
    expect(state.fontSize).toBe(20);
    expect(state.port).toBe(9090);
    expect(state.startBehavior).toBe(DEFAULT_SETTINGS.startBehavior);
  });
});

describe("Settings 렌더링", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isOpen: true,
      draft: { ...DEFAULT_SETTINGS },
    });
  });

  it("설정 모달이 렌더링된다", () => {
    render(<Settings />);
    expect(screen.getByText("설정")).toBeTruthy();
  });

  it("탭이 3개 표시된다", () => {
    render(<Settings />);
    expect(screen.getByText("▪ 일반")).toBeTruthy();
    expect(screen.getByText("▪ 단축키")).toBeTruthy();
    expect(screen.getByText("▪ 프리셋")).toBeTruthy();
  });

  it("단축키 탭 클릭 시 단축키 목록이 표시된다", () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("▪ 단축키"));
    expect(screen.getByText("패널 포커스 전환")).toBeTruthy();
    expect(screen.getByText("새 패널 추가")).toBeTruthy();
  });

  it("프리셋 탭 클릭 시 프리셋 관리가 표시된다", () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("▪ 프리셋"));
    expect(screen.getByText("▪ 프리셋 관리")).toBeTruthy();
  });

  it("저장 버튼 클릭 시 commitDraft 호출", () => {
    render(<Settings />);
    const saveBtn = screen.getByText("▪ 저장");
    fireEvent.click(saveBtn);
    expect(screen.getByText("✔ 저장됨")).toBeTruthy();
  });

  it("닫기 버튼 클릭 시 closeSettings 호출", () => {
    render(<Settings />);
    const closeBtn = screen.getByText("▪ 닫기");
    fireEvent.click(closeBtn);
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it("일반 탭에서 테마 옵션이 표시된다", () => {
    render(<Settings />);
    expect(screen.getByText("Miku")).toBeTruthy();
    expect(screen.getByText("Blue Dark")).toBeTruthy();
  });

  it("일반 탭에서 글씨 크기 옵션이 표시된다", () => {
    render(<Settings />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("16")).toBeTruthy();
  });

  it("role=dialog와 aria-modal이 설정되어 있다", () => {
    const { container } = render(<Settings />);
    const dialog = container.querySelector("[role='dialog']");
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
  });

  it("ESC 키로 모달을 닫을 수 있다", () => {
    render(<Settings />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it("테마 버튼 클릭 시 draft 업데이트", () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("Blue Dark"));
    expect(useSettingsStore.getState().draft?.theme).toBe("blue-dark");
  });

  it("글씨 크기 클릭 시 draft 업데이트", () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("16"));
    expect(useSettingsStore.getState().draft?.fontSize).toBe(16);
  });

  it("시작 동작 라디오 변경", () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("이전 상태 복원"));
    expect(useSettingsStore.getState().draft?.startBehavior).toBe("restore");
  });

  it("백드롭 클릭 시 모달 닫기", () => {
    const { container } = render(<Settings />);
    const backdrop = container.querySelector(".bg-black\\/60");
    if (backdrop) fireEvent.click(backdrop);
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it("헤더 ✕ 버튼 클릭 시 모달 닫기", () => {
    render(<Settings />);
    const closeBtn = screen.getAllByText("✕")[0];
    fireEvent.click(closeBtn);
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });
});
