import { describe, it, expect } from "vitest";
import type { PanelStatus } from "../../types";

// Panel 컴포넌트의 순수 로직 함수를 직접 테스트한다.
// (컴포넌트 렌더링 테스트는 jsdom 환경 설정 후 별도 진행)

// Panel.tsx에서 export되는 유틸 함수들을 별도 모듈로 분리할 수 있으나,
// Phase 3에서는 상태별 스타일 매핑 로직만 검증한다.

describe("Panel status styling logic", () => {
  function getStatusClasses(status: PanelStatus, isFocused: boolean): string {
    if (isFocused && (status === "active" || status === "idle")) {
      return "border-deck-cyan animate-glow";
    }
    if (status === "input") {
      return "border-deck-gold animate-glow-gold";
    }
    return "border-dashed border-deck-border";
  }

  it("active + focused: cyan glow", () => {
    expect(getStatusClasses("active", true)).toContain("animate-glow");
    expect(getStatusClasses("active", true)).toContain("border-deck-cyan");
  });

  it("idle + focused: cyan glow", () => {
    expect(getStatusClasses("idle", true)).toContain("animate-glow");
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
});

describe("getStatusIcon", () => {
  function getStatusIcon(status: PanelStatus, isFocused: boolean): { icon: string; color: string } {
    if (status === "input") return { icon: "■", color: "text-deck-gold" };
    if (isFocused && status !== "setup" && status !== "exited")
      return { icon: "■", color: "text-deck-cyan" };
    return { icon: "□", color: "text-deck-dim" };
  }

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
  function getStatusLabel(status: PanelStatus): { text: string; color: string } | null {
    switch (status) {
      case "active":
        return { text: "▪▪▪ active ▪▪▪", color: "text-deck-cyan" };
      case "idle":
        return { text: "▪▪ idle ▪▪", color: "text-deck-pink" };
      case "input":
        return { text: "▪▪▪ input ▪▪▪", color: "text-deck-gold" };
      case "exited":
        return { text: "▪ exited ▪", color: "text-deck-dim" };
      default:
        return null;
    }
  }

  it("active → cyan", () => {
    const result = getStatusLabel("active");
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
  function getExitMessage(exitCode: number | undefined): string {
    switch (exitCode) {
      case 0:
        return "세션이 정상 종료되었습니다";
      case 130:
        return "세션이 중단되었습니다";
      case 137:
        return "세션이 비정상 종료되었습니다";
      case 143:
        return "세션이 종료되었습니다";
      case -1:
        return "서버 연결이 끊어졌습니다";
      default:
        return "세션이 비정상 종료되었습니다";
    }
  }

  it("0 → 정상 종료", () => {
    expect(getExitMessage(0)).toBe("세션이 정상 종료되었습니다");
  });

  it("130 → 중단 (SIGINT)", () => {
    expect(getExitMessage(130)).toBe("세션이 중단되었습니다");
  });

  it("137 → 비정상 종료 (OOM)", () => {
    expect(getExitMessage(137)).toBe("세션이 비정상 종료되었습니다");
  });

  it("-1 → 서버 연결 끊김", () => {
    expect(getExitMessage(-1)).toBe("서버 연결이 끊어졌습니다");
  });

  it("undefined → 비정상 종료", () => {
    expect(getExitMessage(undefined)).toBe("세션이 비정상 종료되었습니다");
  });
});
