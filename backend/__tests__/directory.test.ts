import { describe, it, expect } from "vitest";
import { autocomplete } from "../directory";

describe("autocomplete", () => {
  it("홈 디렉토리의 하위 디렉토리를 반환한다", async () => {
    const results = await autocomplete("~");
    expect(Array.isArray(results)).toBe(true);
    // 홈 디렉토리에는 일반적으로 숨김 폴더가 아닌 디렉토리가 있다
  });

  it("/tmp를 입력하면 /tmp로 시작하는 결과를 반환한다", async () => {
    const results = await autocomplete("/tmp");
    expect(Array.isArray(results)).toBe(true);
    results.forEach((r) => {
      expect(r.startsWith("/tmp")).toBe(true);
    });
  });

  it("존재하지 않는 경로에 대해 빈 배열을 반환한다", async () => {
    const results = await autocomplete("/nonexistent_path_12345");
    expect(results).toEqual([]);
  });

  it("숨김 디렉토리(.으로 시작)를 제외한다", async () => {
    const results = await autocomplete("~");
    results.forEach((r) => {
      const name = r.split("/").pop();
      expect(name?.startsWith(".")).toBe(false);
    });
  });

  it("결과가 정렬되어 반환된다", async () => {
    const results = await autocomplete("~");
    const sorted = [...results].sort();
    expect(results).toEqual(sorted);
  });
});
