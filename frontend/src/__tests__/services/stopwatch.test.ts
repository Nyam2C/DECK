import { describe, it, expect } from "vitest";
import { formatElapsed } from "../../services/stopwatch";

describe("formatElapsed", () => {
  it("0ms는 00:00:00을 반환한다", () => {
    expect(formatElapsed(0)).toBe("00:00:00");
  });

  it("초 단위를 올바르게 표시한다", () => {
    expect(formatElapsed(5000)).toBe("00:00:05");
    expect(formatElapsed(59000)).toBe("00:00:59");
  });

  it("분 단위를 올바르게 표시한다", () => {
    expect(formatElapsed(60000)).toBe("00:01:00");
    expect(formatElapsed(90000)).toBe("00:01:30");
  });

  it("시간 단위를 올바르게 표시한다", () => {
    expect(formatElapsed(3600000)).toBe("01:00:00");
    expect(formatElapsed(3661000)).toBe("01:01:01");
  });

  it("밀리초 미만은 버린다", () => {
    expect(formatElapsed(999)).toBe("00:00:00");
    expect(formatElapsed(1500)).toBe("00:00:01");
  });
});
