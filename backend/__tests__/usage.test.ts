import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveModelKey,
  calculateCost,
  parseJsonlContent,
  createUsageReader,
  parsePlanName,
  fetchOAuthUsage,
  clearLimitsCache,
  todayStr,
} from "../usage";

describe("usage", () => {
  // ─── resolveModelKey ───

  describe("resolveModelKey", () => {
    it("claude-sonnet-4-20250514 → sonnet-4", () => {
      expect(resolveModelKey("claude-sonnet-4-20250514")).toBe("sonnet-4");
    });

    it("claude-opus-4-6 → opus-4-6", () => {
      expect(resolveModelKey("claude-opus-4-6")).toBe("opus-4-6");
    });

    it("claude-haiku-4-5-20251001 → haiku-4-5", () => {
      expect(resolveModelKey("claude-haiku-4-5-20251001")).toBe("haiku-4-5");
    });

    it("claude-sonnet-4-6 → sonnet-4-6", () => {
      expect(resolveModelKey("claude-sonnet-4-6")).toBe("sonnet-4-6");
    });

    it("알 수 없는 모델은 null", () => {
      expect(resolveModelKey("gpt-4o")).toBeNull();
    });
  });

  // ─── calculateCost ───

  describe("calculateCost", () => {
    it("sonnet-4 1M input + 1M output = $18", () => {
      const cost = calculateCost("sonnet-4", 1_000_000, 1_000_000, 0, 0);
      expect(cost).toBeCloseTo(18, 2);
    });

    it("opus-4-6 캐시 비용 포함", () => {
      // 1M cache write = $5 * 1.25 = $6.25
      // 1M cache read = $5 * 0.1 = $0.50
      const cost = calculateCost("opus-4-6", 0, 0, 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(6.75, 2);
    });

    it("알 수 없는 모델키는 0", () => {
      expect(calculateCost("unknown", 1000, 1000, 0, 0)).toBe(0);
    });
  });

  // ─── parseJsonlContent ───

  describe("parseJsonlContent", () => {
    const today = todayStr();

    it("assistant 메시지에서 usage를 추출한다", () => {
      const line = JSON.stringify({
        type: "assistant",
        timestamp: `${today}T12:00:00Z`,
        requestId: "req-1",
        message: {
          model: "claude-sonnet-4-20250514",
          usage: {
            input_tokens: 100,
            output_tokens: 200,
            cache_creation_input_tokens: 50,
            cache_read_input_tokens: 30,
          },
        },
      });
      const entries = parseJsonlContent(line, today);
      expect(entries).toHaveLength(1);
      expect(entries[0].inputTokens).toBe(100);
      expect(entries[0].outputTokens).toBe(200);
      expect(entries[0].cacheCreateTokens).toBe(50);
      expect(entries[0].cacheReadTokens).toBe(30);
    });

    it("동일 requestId는 마지막 것만 사용", () => {
      const lines = [
        JSON.stringify({
          type: "assistant",
          timestamp: `${today}T12:00:00Z`,
          requestId: "req-dup",
          message: {
            model: "claude-sonnet-4-20250514",
            usage: { input_tokens: 100, output_tokens: 50 },
          },
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: `${today}T12:00:01Z`,
          requestId: "req-dup",
          message: {
            model: "claude-sonnet-4-20250514",
            usage: { input_tokens: 100, output_tokens: 200 },
          },
        }),
      ].join("\n");

      const entries = parseJsonlContent(lines, today);
      expect(entries).toHaveLength(1);
      expect(entries[0].outputTokens).toBe(200);
    });

    it("type이 assistant가 아니면 무시", () => {
      const line = JSON.stringify({
        type: "human",
        timestamp: `${today}T12:00:00Z`,
        requestId: "req-h",
        message: { usage: { input_tokens: 100 } },
      });
      expect(parseJsonlContent(line, today)).toHaveLength(0);
    });

    it("빈 문자열은 빈 배열", () => {
      expect(parseJsonlContent("", today)).toHaveLength(0);
    });
  });

  // ─── createUsageReader (통합) ───

  describe("createUsageReader", () => {
    let dir: string;
    const today = todayStr();

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), "deck-usage-test-"));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it("빈 디렉토리에서 zero usage", async () => {
      const reader = createUsageReader(async () => [dir]);
      const result = await reader.getTodayUsage();
      expect(result.totalCostUSD).toBe(0);
      expect(result.totalInputTokens).toBe(0);
    });

    it("limits 필드가 포함된다", async () => {
      const reader = createUsageReader(async () => [dir]);
      const result = await reader.getTodayUsage();
      // credentials 파일이 없으면 null
      expect(result).toHaveProperty("limits");
    });

    // Windows CI에는 WSL이 없어 readTodayJsonlFiles가 WSL 경로로 실패
    it.skipIf(process.platform === "win32")("JSONL 파일을 읽어 집계한다", async () => {
      const jsonl = [
        JSON.stringify({
          type: "assistant",
          timestamp: `${today}T10:00:00Z`,
          requestId: "r1",
          message: {
            model: "claude-sonnet-4-20250514",
            usage: { input_tokens: 1000, output_tokens: 500 },
          },
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: `${today}T11:00:00Z`,
          requestId: "r2",
          message: {
            model: "claude-opus-4-6",
            usage: { input_tokens: 2000, output_tokens: 1000 },
          },
        }),
      ].join("\n");

      await writeFile(join(dir, "session1.jsonl"), jsonl);

      const reader = createUsageReader(async () => [dir]);
      const result = await reader.getTodayUsage();

      expect(result.totalInputTokens).toBe(3000);
      expect(result.totalOutputTokens).toBe(1500);
      expect(result.totalCostUSD).toBeGreaterThan(0);
      expect(Object.keys(result.byModel)).toContain("sonnet-4");
      expect(Object.keys(result.byModel)).toContain("opus-4-6");
    });
  });

  // ─── OAuth: parsePlanName ───

  describe("parsePlanName", () => {
    it("default_claude_pro → Pro", () => {
      expect(parsePlanName("default_claude_pro")).toBe("Pro");
    });

    it("default_claude_max_5x → Max 5x", () => {
      expect(parsePlanName("default_claude_max_5x")).toBe("Max 5x");
    });

    it("default_claude_max_20x → Max 20x", () => {
      expect(parsePlanName("default_claude_max_20x")).toBe("Max 20x");
    });

    it("알 수 없는 tier는 그대로 반환", () => {
      expect(parsePlanName("some_unknown_tier")).toBe("some_unknown_tier");
    });
  });

  // ─── OAuth: fetchOAuthUsage (mock fetch) ───

  describe("fetchOAuthUsage", () => {
    beforeEach(() => {
      clearLimitsCache();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      clearLimitsCache();
    });

    it("credentials 없으면 null 반환", async () => {
      const result = await fetchOAuthUsage(async () => null);
      expect(result).toBeNull();
    });

    it("API 응답을 UsageLimits로 변환", async () => {
      const mockCreds = async () => ({
        accessToken: "sk-ant-oat-test",
        rateLimitTier: "default_claude_pro",
      });
      const mockResponse = {
        ok: true,
        json: async () => ({
          five_hour: { utilization: 42, resets_at: "2026-02-21T15:00:00Z" },
          seven_day: { utilization: 15, resets_at: "2026-02-28T00:00:00Z" },
          seven_day_opus: { utilization: 32, resets_at: "2026-02-28T00:00:00Z" },
        }),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as Response);

      const result = await fetchOAuthUsage(mockCreds);
      expect(result).not.toBeNull();
      expect(result!.plan).toBe("Pro");
      expect(result!.fiveHour.utilization).toBe(42);
      expect(result!.sevenDay.utilization).toBe(15);
      expect(result!.sevenDayOpus?.utilization).toBe(32);
      expect(result!.sevenDaySonnet).toBeNull();
    });

    it("API 401 에러 시 null 반환", async () => {
      const mockCreds = async () => ({
        accessToken: "sk-ant-oat-expired",
        rateLimitTier: "default_claude_pro",
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401 } as Response);

      const result = await fetchOAuthUsage(mockCreds);
      expect(result).toBeNull();
    });

    it("네트워크 에러 시 null 반환", async () => {
      const mockCreds = async () => ({
        accessToken: "sk-ant-oat-test",
        rateLimitTier: "default_claude_pro",
      });
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await fetchOAuthUsage(mockCreds);
      expect(result).toBeNull();
    });
  });
});
