import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "../../stores/settings-store";
import { DEFAULT_SETTINGS } from "../../types";

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      isOpen: false,
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

  it("openSettings로 isOpen을 true로 변경한다", () => {
    useSettingsStore.getState().openSettings();
    expect(useSettingsStore.getState().isOpen).toBe(true);
  });

  it("closeSettings로 isOpen을 false로 변경한다", () => {
    useSettingsStore.getState().openSettings();
    useSettingsStore.getState().closeSettings();
    expect(useSettingsStore.getState().isOpen).toBe(false);
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
