import { describe, it, expect } from "vitest";
import { getGridClassName, getPanelSpanClassName } from "../../components/Grid";

describe("getGridClassName", () => {
  it("1개 패널: grid-cols-1 grid-rows-1", () => {
    const cls = getGridClassName(1, false);
    expect(cls).toContain("grid-cols-1");
    expect(cls).toContain("grid-rows-1");
  });

  it("2개 패널: grid-cols-2 grid-rows-1", () => {
    const cls = getGridClassName(2, false);
    expect(cls).toContain("grid-cols-2");
    expect(cls).toContain("grid-rows-1");
  });

  it("3개 패널: grid-cols-2 grid-rows-2", () => {
    const cls = getGridClassName(3, false);
    expect(cls).toContain("grid-cols-2");
    expect(cls).toContain("grid-rows-2");
  });

  it("4개 패널: grid-cols-2 grid-rows-2", () => {
    const cls = getGridClassName(4, false);
    expect(cls).toContain("grid-cols-2");
    expect(cls).toContain("grid-rows-2");
  });

  it("항상 min-w-[800px]를 포함한다", () => {
    for (let i = 1; i <= 4; i++) {
      expect(getGridClassName(i, false)).toContain("min-w-[800px]");
    }
  });

  it("핀 모드: 2개일 때 grid-cols-[7fr_3fr]", () => {
    const cls = getGridClassName(2, true);
    expect(cls).toContain("grid-cols-[7fr_3fr]");
  });
});

describe("getPanelSpanClassName", () => {
  it("3개 패널의 마지막(index 2)에 col-span-2", () => {
    expect(getPanelSpanClassName(2, 3, false, false)).toBe("col-span-2");
  });

  it("3개 패널의 처음(index 0)에 빈 문자열", () => {
    expect(getPanelSpanClassName(0, 3, false, false)).toBe("");
  });

  it("4개 패널에서는 col-span-2 없음", () => {
    for (let i = 0; i < 4; i++) {
      expect(getPanelSpanClassName(i, 4, false, false)).toBe("");
    }
  });
});
