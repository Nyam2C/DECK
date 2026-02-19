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
  // 일반 모드: 모든 경우 명시적 배치
  it("1개 패널: col-start-1 row-start-1", () => {
    expect(getPanelSpanClassName(0, 1, false, false)).toContain("col-start-1");
    expect(getPanelSpanClassName(0, 1, false, false)).toContain("row-start-1");
  });

  it("2개 패널: 명시적 좌우 배치", () => {
    expect(getPanelSpanClassName(0, 2, false, false)).toContain("col-start-1");
    expect(getPanelSpanClassName(1, 2, false, false)).toContain("col-start-2");
  });

  it("3개 패널의 마지막(index 2)에 오른쪽 전체 높이", () => {
    const cls = getPanelSpanClassName(2, 3, false, false);
    expect(cls).toContain("row-span-2");
    expect(cls).toContain("col-start-2");
  });

  it("3개 패널의 처음(index 0)에 왼쪽 위 배치", () => {
    const cls = getPanelSpanClassName(0, 3, false, false);
    expect(cls).toContain("col-start-1");
    expect(cls).toContain("row-start-1");
  });

  it("3개 패널의 두번째(index 1)에 왼쪽 아래 배치", () => {
    const cls = getPanelSpanClassName(1, 3, false, false);
    expect(cls).toContain("col-start-1");
    expect(cls).toContain("row-start-2");
  });

  it("4개 패널: 명시적 2x2 배치", () => {
    expect(getPanelSpanClassName(0, 4, false, false)).toContain("col-start-1 row-start-1");
    expect(getPanelSpanClassName(1, 4, false, false)).toContain("col-start-2 row-start-1");
    expect(getPanelSpanClassName(2, 4, false, false)).toContain("col-start-1 row-start-2");
    expect(getPanelSpanClassName(3, 4, false, false)).toContain("col-start-2 row-start-2");
  });

  // 핀 레이아웃
  it("핀 모드: 핀 패널은 왼쪽 전체 높이 (3개)", () => {
    const cls = getPanelSpanClassName(0, 3, true, true);
    expect(cls).toContain("col-start-1");
    expect(cls).toContain("row-span-2");
  });

  it("핀 모드: 핀 패널은 왼쪽 전체 높이 (4개)", () => {
    const cls = getPanelSpanClassName(0, 4, true, true);
    expect(cls).toContain("col-start-1");
    expect(cls).toContain("row-span-3");
  });

  it("핀 모드: 나머지 패널은 오른쪽 각 행", () => {
    // 3개 중 핀 1개: 나머지 2개 (index 1, 2)
    expect(getPanelSpanClassName(1, 3, true, false)).toContain("col-start-2 row-start-1");
    expect(getPanelSpanClassName(2, 3, true, false)).toContain("col-start-2 row-start-2");
  });

  it("핀 모드: 4개 중 나머지 3개 배치", () => {
    expect(getPanelSpanClassName(1, 4, true, false)).toContain("col-start-2 row-start-1");
    expect(getPanelSpanClassName(2, 4, true, false)).toContain("col-start-2 row-start-2");
    expect(getPanelSpanClassName(3, 4, true, false)).toContain("col-start-2 row-start-3");
  });
});
