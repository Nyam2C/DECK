import { describe, it, expect } from "vitest";
import { isLeaderKey } from "../../hooks/use-keyboard";

function makeKeyEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: "",
    code: "",
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...overrides,
  } as KeyboardEvent;
}

describe("isLeaderKey", () => {
  it("Ctrl+Space를 감지한다", () => {
    const e = makeKeyEvent({ key: " ", code: "Space", ctrlKey: true });
    expect(isLeaderKey(e, "Ctrl+Space")).toBe(true);
  });

  it("Space만으로는 감지하지 않는다", () => {
    const e = makeKeyEvent({ key: " ", code: "Space" });
    expect(isLeaderKey(e, "Ctrl+Space")).toBe(false);
  });

  it("Ctrl+Shift+Space는 감지하지 않는다", () => {
    const e = makeKeyEvent({ key: " ", code: "Space", ctrlKey: true, shiftKey: true });
    expect(isLeaderKey(e, "Ctrl+Space")).toBe(false);
  });

  it("커스텀 리더키를 지원한다", () => {
    const e = makeKeyEvent({ key: "k", code: "KeyK", ctrlKey: true });
    expect(isLeaderKey(e, "Ctrl+k")).toBe(true);
  });

  it("Alt+Space 설정도 동작한다", () => {
    const e = makeKeyEvent({ key: " ", code: "Space", altKey: true });
    expect(isLeaderKey(e, "Alt+Space")).toBe(true);
  });

  it("Meta 키를 지원한다", () => {
    const e = makeKeyEvent({ key: "d", code: "KeyD", metaKey: true });
    expect(isLeaderKey(e, "Meta+d")).toBe(true);
  });

  it("Meta 키 없이 Meta 설정은 실패", () => {
    const e = makeKeyEvent({ key: "d", code: "KeyD" });
    expect(isLeaderKey(e, "Meta+d")).toBe(false);
  });

  it("Ctrl+Shift 조합을 지원한다", () => {
    const e = makeKeyEvent({ key: "p", code: "KeyP", ctrlKey: true, shiftKey: true });
    expect(isLeaderKey(e, "Ctrl+Shift+p")).toBe(true);
  });

  it("code 기반으로도 매칭된다", () => {
    const e = makeKeyEvent({ key: "", code: "space", ctrlKey: true });
    expect(isLeaderKey(e, "Ctrl+space")).toBe(true);
  });

  it("Alt 키 없이 Alt 설정은 실패", () => {
    const e = makeKeyEvent({ key: "x", code: "KeyX", ctrlKey: true });
    expect(isLeaderKey(e, "Alt+x")).toBe(false);
  });
});
