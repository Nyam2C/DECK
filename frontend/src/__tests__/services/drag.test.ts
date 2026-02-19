import { describe, it, expect } from "vitest";
import { reorderPanelIds } from "../../services/drag";

describe("reorderPanelIds", () => {
  it("[A,B,C] A↔C = [C,B,A]", () => {
    expect(reorderPanelIds(["A", "B", "C"], "A", "C")).toEqual(["C", "B", "A"]);
  });

  it("[A,B,C,D] A↔C = [C,B,A,D]", () => {
    expect(reorderPanelIds(["A", "B", "C", "D"], "A", "C")).toEqual(["C", "B", "A", "D"]);
  });

  it("[A,B,C,D] D↔A = [D,B,C,A]", () => {
    expect(reorderPanelIds(["A", "B", "C", "D"], "D", "A")).toEqual(["D", "B", "C", "A"]);
  });

  it("[A,B,C] B↔C = [A,C,B]", () => {
    expect(reorderPanelIds(["A", "B", "C"], "B", "C")).toEqual(["A", "C", "B"]);
  });

  it("인접한 패널 교환: [A,B] A↔B = [B,A]", () => {
    expect(reorderPanelIds(["A", "B"], "A", "B")).toEqual(["B", "A"]);
  });

  it("동일 위치 드롭 시 변화 없음", () => {
    expect(reorderPanelIds(["A", "B", "C"], "B", "B")).toEqual(["A", "B", "C"]);
  });

  it("존재하지 않는 ID는 원본 반환", () => {
    expect(reorderPanelIds(["A", "B"], "X", "A")).toEqual(["A", "B"]);
  });
});
