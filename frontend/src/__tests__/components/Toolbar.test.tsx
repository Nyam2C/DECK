// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { loadStopwatch, saveStopwatch } from "../../components/Toolbar";
import { Toolbar } from "../../components/Toolbar";
import { usePanelStore } from "../../stores/panel-store";
import { useSettingsStore } from "../../stores/settings-store";
import { DEFAULT_SETTINGS } from "../../types";

describe("Toolbar — stopwatch logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadStopwatch", () => {
    it("localStorage 비어있으면 기본값 반환", () => {
      const state = loadStopwatch();
      expect(state).toEqual({ elapsed: 0, running: false, lastTick: 0 });
    });

    it("저장된 정지 상태를 복원한다", () => {
      localStorage.setItem(
        "deck-stopwatch",
        JSON.stringify({ elapsed: 5000, running: false, lastTick: 0 }),
      );
      const state = loadStopwatch();
      expect(state.elapsed).toBe(5000);
      expect(state.running).toBe(false);
    });

    it("running 상태에서 경과 시간을 보정한다", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now + 1000);
      localStorage.setItem(
        "deck-stopwatch",
        JSON.stringify({ elapsed: 5000, running: true, lastTick: now }),
      );
      const state = loadStopwatch();
      expect(state.elapsed).toBe(6000);
      expect(state.running).toBe(true);
      vi.restoreAllMocks();
    });

    it("잘못된 JSON이면 기본값 반환", () => {
      localStorage.setItem("deck-stopwatch", "invalid json");
      const state = loadStopwatch();
      expect(state).toEqual({ elapsed: 0, running: false, lastTick: 0 });
    });
  });

  describe("saveStopwatch", () => {
    it("상태를 localStorage에 저장한다", () => {
      saveStopwatch({ elapsed: 3000, running: true, lastTick: 12345 });
      const raw = localStorage.getItem("deck-stopwatch");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.elapsed).toBe(3000);
      expect(parsed.running).toBe(true);
      expect(parsed.lastTick).toBe(12345);
    });
  });
});

describe("Toolbar — 렌더링", () => {
  beforeEach(() => {
    localStorage.clear();
    usePanelStore.setState({ panels: [], focusedId: null, pinnedId: null });
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, isOpen: false, draft: null });
  });

  it("Toolbar가 렌더링된다", () => {
    render(<Toolbar />);
    expect(screen.getByText("▪ DECK")).toBeTruthy();
  });

  it("새 패널 추가 버튼이 표시된다", () => {
    render(<Toolbar />);
    expect(screen.getByText("＋")).toBeTruthy();
  });

  it("스톱워치 버튼이 표시된다", () => {
    render(<Toolbar />);
    expect(screen.getByText("⏱")).toBeTruthy();
  });

  it("설정 버튼이 표시된다", () => {
    render(<Toolbar />);
    expect(screen.getByText("⚙")).toBeTruthy();
  });

  it("스톱워치 클릭 시 드롭다운이 열린다", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText("⏱"));
    expect(screen.getByText("▶ 시작")).toBeTruthy();
  });

  it("스톱워치 시작/정지 동작", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText("⏱"));
    fireEvent.click(screen.getByText("▶ 시작"));
    expect(screen.getByText("⏸ 정지")).toBeTruthy();
  });

  it("스톱워치 리셋 동작", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText("⏱"));
    fireEvent.click(screen.getByText("▶ 시작"));
    fireEvent.click(screen.getByText("↺ 리셋"));
    expect(screen.getByText("▶ 시작")).toBeTruthy();
  });

  it("aria-label이 설정되어 있다", () => {
    render(<Toolbar />);
    expect(screen.getByLabelText("새 패널 추가")).toBeTruthy();
    expect(screen.getByLabelText("스톱워치")).toBeTruthy();
    expect(screen.getByLabelText("설정")).toBeTruthy();
  });

  it("miku 테마에서 스프라이트가 표시된다", () => {
    const { container } = render(<Toolbar />);
    const sprites = container.querySelectorAll("img.miku-sprite");
    expect(sprites.length).toBeGreaterThan(0);
  });

  it("MAX_PANELS 도달 시 추가 버튼이 비활성화된다", () => {
    for (let i = 0; i < 4; i++) {
      usePanelStore.getState().addPanel();
    }
    render(<Toolbar />);
    const addBtn = screen.getByLabelText("새 패널 추가");
    expect(addBtn.hasAttribute("disabled")).toBe(true);
  });
});
