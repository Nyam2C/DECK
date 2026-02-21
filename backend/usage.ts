import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { isWindows, getWslHomedir, wslExec } from "./wsl";

export interface UsageLimits {
  plan: string;
  fiveHour: { utilization: number; resetsAt: string };
  sevenDay: { utilization: number; resetsAt: string };
  sevenDayOpus?: { utilization: number; resetsAt: string } | null;
  sevenDaySonnet?: { utilization: number; resetsAt: string } | null;
}

export interface UsageSummary {
  date: string;
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreateTokens: number;
  totalCacheReadTokens: number;
  byModel: Record<
    string,
    {
      costUSD: number;
      inputTokens: number;
      outputTokens: number;
    }
  >;
  limits: UsageLimits | null;
}

// 가격: $ per 1M tokens
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "opus-4-6": { input: 5, output: 25 },
  "opus-4-5": { input: 5, output: 25 },
  "sonnet-4-6": { input: 3, output: 15 },
  "sonnet-4-5": { input: 3, output: 15 },
  "sonnet-4": { input: 3, output: 15 },
  "haiku-4-5": { input: 1, output: 5 },
};

/**
 * "claude-sonnet-4-20250514" → "sonnet-4"
 * "claude-opus-4-6" → "opus-4-6"
 */
export function resolveModelKey(model: string): string | null {
  // claude- 접두사 제거
  let key = model.replace(/^claude-/, "");
  // 날짜 접미사 제거 (e.g. -20250514)
  key = key.replace(/-\d{8}$/, "");

  if (MODEL_PRICING[key]) return key;

  // prefix match: "sonnet-4-6-xxx" → "sonnet-4-6"
  for (const k of Object.keys(MODEL_PRICING)) {
    if (key.startsWith(k)) return k;
  }
  return null;
}

export function calculateCost(
  modelKey: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreateTokens: number,
  cacheReadTokens: number,
): number {
  const pricing = MODEL_PRICING[modelKey];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheWriteCost = (cacheCreateTokens / 1_000_000) * pricing.input * 1.25;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.input * 0.1;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

function emptyUsage(date: string): UsageSummary {
  return {
    date,
    totalCostUSD: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreateTokens: 0,
    totalCacheReadTokens: 0,
    byModel: {},
    limits: null,
  };
}

// ─── OAuth Usage API ───

const PLAN_NAMES: Record<string, string> = {
  default_claude_pro: "Pro",
  default_claude_max_5x: "Max 5x",
  default_claude_max_20x: "Max 20x",
};

export function parsePlanName(rateLimitTier: string): string {
  return PLAN_NAMES[rateLimitTier] ?? rateLimitTier;
}

interface OAuthCredentials {
  accessToken: string;
  rateLimitTier: string;
}

export async function readCredentials(): Promise<OAuthCredentials | null> {
  try {
    let raw: string;
    if (isWindows) {
      const wslHome = getWslHomedir();
      raw = await wslExec(`cat '${wslHome}/.claude/.credentials.json'`);
    } else {
      const home = homedir();
      raw = await readFile(join(home, ".claude", ".credentials.json"), "utf-8");
    }
    const parsed = JSON.parse(raw);
    const oauth = parsed?.claudeAiOauth;
    if (!oauth?.accessToken) return null;
    return {
      accessToken: oauth.accessToken,
      rateLimitTier: oauth.rateLimitTier ?? "",
    };
  } catch {
    return null;
  }
}

// 인메모리 캐시: 60초 TTL
let limitsCache: { data: UsageLimits; expiresAt: number } | null = null;

export async function fetchOAuthUsage(
  getCreds: () => Promise<OAuthCredentials | null> = readCredentials,
): Promise<UsageLimits | null> {
  // 캐시 유효하면 반환
  if (limitsCache && Date.now() < limitsCache.expiresAt) {
    return limitsCache.data;
  }

  const creds = await getCreds();
  if (!creds) return null;

  try {
    const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
      },
    });
    if (!res.ok) return null;

    const body = await res.json();
    const limits: UsageLimits = {
      plan: parsePlanName(creds.rateLimitTier),
      fiveHour: {
        utilization: body.five_hour?.utilization ?? 0,
        resetsAt: body.five_hour?.resets_at ?? "",
      },
      sevenDay: {
        utilization: body.seven_day?.utilization ?? 0,
        resetsAt: body.seven_day?.resets_at ?? "",
      },
      sevenDayOpus: body.seven_day_opus
        ? {
            utilization: body.seven_day_opus.utilization ?? 0,
            resetsAt: body.seven_day_opus.resets_at ?? "",
          }
        : null,
      sevenDaySonnet: body.seven_day_sonnet
        ? {
            utilization: body.seven_day_sonnet.utilization ?? 0,
            resetsAt: body.seven_day_sonnet.resets_at ?? "",
          }
        : null,
    };

    limitsCache = { data: limits, expiresAt: Date.now() + 60_000 };
    return limits;
  } catch {
    return null;
  }
}

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isModifiedToday(mtimeMs: number): boolean {
  const today = new Date();
  const mtime = new Date(mtimeMs);
  return (
    mtime.getFullYear() === today.getFullYear() &&
    mtime.getMonth() === today.getMonth() &&
    mtime.getDate() === today.getDate()
  );
}

interface ParsedEntry {
  requestId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
}

function parseJsonlContent(content: string, today: string): ParsedEntry[] {
  const byRequest = new Map<string, ParsedEntry>();

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;

    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    if (obj.type !== "assistant") continue;

    // 오늘 날짜 필터
    const ts = obj.timestamp;
    if (ts && typeof ts === "string" && !ts.startsWith(today)) continue;

    const usage = obj.message?.usage;
    const model: string = obj.message?.model ?? "";
    const requestId: string = obj.requestId ?? "";
    if (!usage || !model || !requestId) continue;

    // 동일 requestId → 마지막 것이 최종 (스트리밍 업데이트)
    byRequest.set(requestId, {
      requestId,
      model,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheCreateTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    });
  }

  return Array.from(byRequest.values());
}

async function findClaudeProjectDirs(): Promise<string[]> {
  const dirs: string[] = [];

  if (isWindows) {
    try {
      const wslHome = getWslHomedir();
      const candidates = [`${wslHome}/.claude/projects`, `${wslHome}/.config/claude/projects`];
      for (const base of candidates) {
        try {
          const output = await wslExec(`ls '${base.replace(/'/g, "'\\''")}'`);
          const entries = output.split("\n").filter((e) => e.trim());
          for (const entry of entries) {
            dirs.push(`${base}/${entry}`);
          }
        } catch {
          // 디렉토리 없음
        }
      }
    } catch {
      // WSL 없음
    }
    return dirs;
  }

  const home = homedir();
  const candidates = [
    join(home, ".claude", "projects"),
    join(home, ".config", "claude", "projects"),
  ];
  for (const base of candidates) {
    try {
      const entries = await readdir(base);
      for (const entry of entries) {
        dirs.push(join(base, entry));
      }
    } catch {
      // 디렉토리 없음
    }
  }
  return dirs;
}

async function readTodayJsonlFiles(projectDir: string, today: string): Promise<ParsedEntry[]> {
  const entries: ParsedEntry[] = [];

  if (isWindows) {
    // WSL: stat + cat via wslExec
    try {
      const q = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
      const listing = await wslExec(
        `find ${q(projectDir)} -name '*.jsonl' -newermt '${today}' 2>/dev/null`,
      );
      const files = listing.split("\n").filter((f) => f.trim());
      for (const file of files) {
        try {
          const content = await wslExec(`cat ${q(file)}`);
          entries.push(...parseJsonlContent(content, today));
        } catch {
          // 읽기 실패
        }
      }
    } catch {
      // find 실패
    }
    return entries;
  }

  try {
    const files = await readdir(projectDir);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const fullPath = join(projectDir, file);
      try {
        const s = await stat(fullPath);
        if (!isModifiedToday(s.mtimeMs)) continue;
        const content = await readFile(fullPath, "utf-8");
        entries.push(...parseJsonlContent(content, today));
      } catch {
        // 읽기 실패
      }
    }
  } catch {
    // 디렉토리 없음
  }
  return entries;
}

export function createUsageReader(findDirs: () => Promise<string[]> = findClaudeProjectDirs) {
  async function getTodayUsage(): Promise<UsageSummary> {
    const today = todayStr();
    const summary = emptyUsage(today);

    try {
      const dirs = await findDirs();
      for (const dir of dirs) {
        const entries = await readTodayJsonlFiles(dir, today);
        for (const entry of entries) {
          const modelKey = resolveModelKey(entry.model);
          if (!modelKey) continue;

          const cost = calculateCost(
            modelKey,
            entry.inputTokens,
            entry.outputTokens,
            entry.cacheCreateTokens,
            entry.cacheReadTokens,
          );

          summary.totalInputTokens += entry.inputTokens;
          summary.totalOutputTokens += entry.outputTokens;
          summary.totalCacheCreateTokens += entry.cacheCreateTokens;
          summary.totalCacheReadTokens += entry.cacheReadTokens;
          summary.totalCostUSD += cost;

          if (!summary.byModel[modelKey]) {
            summary.byModel[modelKey] = { costUSD: 0, inputTokens: 0, outputTokens: 0 };
          }
          summary.byModel[modelKey].costUSD += cost;
          summary.byModel[modelKey].inputTokens += entry.inputTokens;
          summary.byModel[modelKey].outputTokens += entry.outputTokens;
        }
      }
    } catch {
      // 전체 실패 시 빈 결과 반환
    }

    // 소수점 정리
    summary.totalCostUSD = Math.round(summary.totalCostUSD * 100) / 100;
    for (const m of Object.values(summary.byModel)) {
      m.costUSD = Math.round(m.costUSD * 100) / 100;
    }

    // OAuth Usage API (실패해도 비용 데이터는 반환)
    summary.limits = await fetchOAuthUsage();

    return summary;
  }

  return { getTodayUsage };
}

// 기본 인스턴스
const defaultReader = createUsageReader();
export const { getTodayUsage } = defaultReader;

// 테스트용 내부 함수 export
export { parseJsonlContent };

/** 테스트용: 캐시 초기화 */
export function clearLimitsCache(): void {
  limitsCache = null;
}
