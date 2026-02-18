import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "../../stores/settings-store";
import { DEFAULT_SETTINGS } from "../../types";

// Settings 컴포넌트의 스토어 연동 로직을 테스트한다.
// (DOM 렌더링 테스트는 jsdom 환경 설정 후 별도 진행)

describe("Settings 스토어 연동", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isOpen: false,
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
