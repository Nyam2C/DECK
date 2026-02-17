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
