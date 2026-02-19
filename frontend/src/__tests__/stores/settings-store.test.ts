import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "../../stores/settings-store";
import { DEFAULT_SETTINGS } from "../../types";

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isOpen: false,
      draft: null,
    });
  });

  it("기본값이 DEFAULT_SETTINGS와 일치한다", () => {
    const state = useSettingsStore.getState();
    expect(state.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(state.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(state.startBehavior).toBe(DEFAULT_SETTINGS.startBehavior);
    expect(state.port).toBe(DEFAULT_SETTINGS.port);
    expect(state.scrollback).toBe(DEFAULT_SETTINGS.scrollback);
    expect(state.leaderKey).toBe(DEFAULT_SETTINGS.leaderKey);
    expect(state.defaultPath).toBe(DEFAULT_SETTINGS.defaultPath);
  });

  it("updateSettings로 값을 변경한다", () => {
    useSettingsStore.getState().updateSettings({ fontSize: 18, port: 8080 });
    const state = useSettingsStore.getState();
    expect(state.fontSize).toBe(18);
    expect(state.port).toBe(8080);
  });

  it("updateSettings는 다른 값에 영향을 주지 않는다", () => {
    useSettingsStore.getState().updateSettings({ fontSize: 20 });
    const state = useSettingsStore.getState();
    expect(state.scrollback).toBe(DEFAULT_SETTINGS.scrollback);
    expect(state.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it("openSettings로 isOpen을 true로, draft를 현재 값으로 설정한다", () => {
    useSettingsStore.getState().updateSettings({ fontSize: 20 });
    useSettingsStore.getState().openSettings();
    const state = useSettingsStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.draft).not.toBeNull();
    expect(state.draft!.fontSize).toBe(20);
  });

  it("closeSettings로 draft를 폐기한다", () => {
    useSettingsStore.getState().openSettings();
    useSettingsStore.getState().updateDraft({ fontSize: 99 });
    useSettingsStore.getState().closeSettings();
    const state = useSettingsStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.draft).toBeNull();
    expect(state.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it("updateDraft는 draft만 변경하고 실제 설정은 유지한다", () => {
    useSettingsStore.getState().openSettings();
    useSettingsStore.getState().updateDraft({ fontSize: 24, theme: "blue-dark" });
    const state = useSettingsStore.getState();
    expect(state.draft!.fontSize).toBe(24);
    expect(state.draft!.theme).toBe("blue-dark");
    expect(state.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(state.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it("commitDraft로 draft를 실제 설정에 반영하고 모달은 열린 채 유지한다", () => {
    useSettingsStore.getState().openSettings();
    useSettingsStore.getState().updateDraft({ fontSize: 18, port: 8080 });
    useSettingsStore.getState().commitDraft();
    const state = useSettingsStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.draft).not.toBeNull();
    expect(state.fontSize).toBe(18);
    expect(state.port).toBe(8080);
    expect(state.scrollback).toBe(DEFAULT_SETTINGS.scrollback);
  });

  it("startBehavior를 restore로 변경할 수 있다", () => {
    useSettingsStore.getState().updateSettings({ startBehavior: "restore" });
    expect(useSettingsStore.getState().startBehavior).toBe("restore");
  });

  it("scrollback 값을 변경할 수 있다", () => {
    useSettingsStore.getState().updateSettings({ scrollback: 10000 });
    expect(useSettingsStore.getState().scrollback).toBe(10000);
  });

  it("theme를 변경할 수 있다", () => {
    expect(useSettingsStore.getState().theme).toBe("miku");
    useSettingsStore.getState().updateSettings({ theme: "blue-dark" });
    expect(useSettingsStore.getState().theme).toBe("blue-dark");
  });
});
