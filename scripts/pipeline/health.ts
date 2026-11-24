/**
 * 源站健康状态：tables/health.json 的解析、构建与 stale 判定。
 *
 * 状态按源 URL 记录，与 state.toml 同键；health.json 只由管线写入，
 * Worker 读取后把 status/last_success/reason 合并进站点清单。
 */

import { isRecord } from "../guards.ts";

import { describeError } from "./errors.ts";
import { FetchTableError, type FetchFailureReason } from "./fetch.ts";
import { compareUtf8 } from "./json-utils.ts";
import { UnsafeFetchTargetError } from "./net-guard.ts";
import type { SyncState } from "./state.ts";

export type StaleReason = FetchFailureReason;

export type HealthStatus = "ok" | "stale";

export interface TableHealth {
  status: HealthStatus;
  lastSuccess?: string | undefined;
  lastAttempt: string;
  consecutiveFailures: number;
  firstFailureAt?: string | undefined;
  reason?: StaleReason | undefined;
}

export interface HealthFile {
  generatedAt: string;
  tables: Map<string, TableHealth>;
}

export type FetchOutcome =
  | { kind: "ok" }
  | { kind: "failed"; reason: StaleReason }
  | { kind: "skipped" };

/** 瞬时错误进入 stale 所需的连续失败时长。 */
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** stale 表的复查间隔。 */
export const MONTHLY_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;

/** 终态错误进入 stale 所需的连续失败轮数。 */
export const TERMINAL_FAILURE_THRESHOLD = 2;

const TERMINAL_REASONS: ReadonlySet<StaleReason> = new Set([
  "source_gone",
  "gas_runtime_retired",
  "access_denied",
]);

const REASON_LABELS: Readonly<Record<StaleReason, string>> = {
  source_gone: "源站已下线",
  gas_runtime_retired: "源站 Apps Script 仍是 Rhino",
  access_denied: "源站拒绝访问",
  network: "网络失败",
  unknown: "未知错误",
};

/**
 * 首次生成 health.json 时的种子：已有证据确认的终态死表。
 *
 * seed 只在该 URL 还没有健康记录时生效；last_success 取 state.toml 的
 * last_change 作为数据最后更新时间的近似值。
 */
export const SEED_STALE: Readonly<Record<string, StaleReason>> = {
  "http://lr2.sakura.ne.jp/overjoy.php": "source_gone",
  "https://egret0.github.io/EGRETjoy/": "source_gone",
  "https://kerocomino.github.io/tinnitus/": "source_gone",
  "https://skar-wem.github.io/table/": "source_gone",
  "https://siromarudaisuki.github.io/akather.sabun/table.html": "access_denied",
};

/** 是否为终态原因：连续两轮即进入 stale。 */
export function isTerminalReason(reason: StaleReason): boolean {
  return TERMINAL_REASONS.has(reason);
}

/** 中文原因标签，用于 warnings.log 与终端输出。 */
export function reasonLabel(reason: StaleReason): string {
  return REASON_LABELS[reason];
}

function parseDate(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") {
    return undefined;
  }
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

function parseReason(value: unknown): StaleReason | undefined {
  if (
    value === "source_gone" ||
    value === "gas_runtime_retired" ||
    value === "access_denied" ||
    value === "network" ||
    value === "unknown"
  ) {
    return value;
  }
  return undefined;
}

/** 解析 health.json；结构不可用时返回 null，坏条目跳过。 */
export function parseHealthFile(text: string): HealthFile | null {
  let root: unknown;
  try {
    root = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(root)) {
    return null;
  }
  const generatedAt = parseDate(root.generated_at);
  const tablesValue = root.tables;
  if (generatedAt === undefined || !isRecord(tablesValue)) {
    return null;
  }
  const tables = new Map<string, TableHealth>();
  for (const [url, value] of Object.entries(tablesValue)) {
    if (!isRecord(value)) {
      continue;
    }
    const status = value.status;
    const lastAttempt = parseDate(value.last_attempt);
    const failures = value.consecutive_failures;
    if (
      (status !== "ok" && status !== "stale") ||
      lastAttempt === undefined ||
      typeof failures !== "number" ||
      !Number.isFinite(failures) ||
      failures < 0
    ) {
      continue;
    }
    const lastSuccess = parseDate(value.last_success);
    const firstFailureAt = parseDate(value.first_failure_at);
    const reason = parseReason(value.reason);
    tables.set(url, {
      status,
      ...(lastSuccess === undefined ? {} : { lastSuccess }),
      lastAttempt,
      consecutiveFailures: Math.floor(failures),
      ...(firstFailureAt === undefined ? {} : { firstFailureAt }),
      ...(reason === undefined ? {} : { reason }),
    });
  }
  return { generatedAt, tables };
}

/** 序列化为稳定 JSON：URL 按字节序排序，字段顺序固定。 */
export function serializeHealthFile(health: HealthFile): string {
  const urls = [...health.tables.keys()].sort(compareUtf8);
  const tables: Record<string, Record<string, unknown>> = {};
  for (const url of urls) {
    const table = health.tables.get(url);
    if (table === undefined) {
      continue;
    }
    tables[url] = {
      status: table.status,
      ...(table.lastSuccess === undefined ? {} : { last_success: table.lastSuccess }),
      last_attempt: table.lastAttempt,
      consecutive_failures: table.consecutiveFailures,
      ...(table.firstFailureAt === undefined ? {} : { first_failure_at: table.firstFailureAt }),
      reason: table.reason ?? null,
    };
  }
  return JSON.stringify({ generated_at: health.generatedAt, tables }, null, 2);
}

export interface InitialHealthOptions {
  previous: HealthFile | null;
  state: SyncState | null;
  activeUrls: ReadonlySet<string>;
  now: Date;
}

/**
 * 初始化当前活跃表的健康状态：保留旧状态，缺省项用 seed 或 state 的
 * last_change 作为数据最后更新时间。
 */
export function initialHealthState(options: InitialHealthOptions): HealthFile {
  const nowIso = options.now.toISOString();
  const tables = new Map<string, TableHealth>();
  for (const url of options.activeUrls) {
    const previous = options.previous?.tables.get(url);
    if (previous !== undefined) {
      tables.set(url, previous);
      continue;
    }
    const lastSuccess = options.state?.tables.get(url)?.lastChange;
    const seedReason = SEED_STALE[url];
    if (seedReason !== undefined) {
      tables.set(url, {
        status: "stale",
        ...(lastSuccess === undefined ? {} : { lastSuccess }),
        lastAttempt: nowIso,
        consecutiveFailures: TERMINAL_FAILURE_THRESHOLD,
        reason: seedReason,
      });
      continue;
    }
    tables.set(url, {
      status: "ok",
      ...(lastSuccess === undefined ? {} : { lastSuccess }),
      lastAttempt: nowIso,
      consecutiveFailures: 0,
    });
  }
  return { generatedAt: nowIso, tables };
}

/** stale 表是否到了月度复查时间。 */
export function shouldRecheck(health: TableHealth, now: Date): boolean {
  if (health.status !== "stale") {
    return true;
  }
  const lastAttempt = Date.parse(health.lastAttempt);
  if (!Number.isFinite(lastAttempt)) {
    return true;
  }
  return now.getTime() - lastAttempt >= MONTHLY_RECHECK_MS;
}

/**
 * 把本轮结果合并进健康状态。跳过项保持原样。
 *
 * last_success 表示数据最后成功更新时间：成功时取新 state 的 last_change，
 * 数据没变时仍是旧值；失败时沿用旧值。它不是每轮抓取时间。
 */
export function buildHealthState(
  previous: HealthFile,
  outcomes: ReadonlyMap<string, FetchOutcome>,
  now: Date,
  lastChangeByUrl: ReadonlyMap<string, string>
): HealthFile {
  const nowIso = now.toISOString();
  const tables = new Map<string, TableHealth>();
  for (const [url, health] of previous.tables) {
    const outcome = outcomes.get(url);
    if (outcome === undefined || outcome.kind === "skipped") {
      tables.set(url, health);
      continue;
    }
    if (outcome.kind === "ok") {
      const lastSuccess = lastChangeByUrl.get(url) ?? health.lastSuccess;
      tables.set(url, {
        status: "ok",
        ...(lastSuccess === undefined ? {} : { lastSuccess }),
        lastAttempt: nowIso,
        consecutiveFailures: 0,
      });
      continue;
    }

    const failures = health.consecutiveFailures + 1;
    const firstFailureAt =
      health.firstFailureAt ?? (health.consecutiveFailures === 0 ? nowIso : health.lastAttempt);
    const terminal = isTerminalReason(outcome.reason) && failures >= TERMINAL_FAILURE_THRESHOLD;
    const transient =
      !isTerminalReason(outcome.reason) &&
      now.getTime() - Date.parse(firstFailureAt) >= STALE_AFTER_MS;
    const stale = health.status === "stale" || terminal || transient;
    const reason =
      health.status === "stale" && health.reason !== undefined && !isTerminalReason(outcome.reason)
        ? health.reason
        : outcome.reason;
    tables.set(url, {
      status: stale ? "stale" : "ok",
      ...(health.lastSuccess === undefined ? {} : { lastSuccess: health.lastSuccess }),
      lastAttempt: nowIso,
      consecutiveFailures: failures,
      firstFailureAt,
      ...(stale ? { reason } : {}),
    });
  }
  return { generatedAt: nowIso, tables };
}

/** 从抓取异常判断原因；只区分终态与瞬时，不解析自由文本细节。 */
export function classifyFetchError(error: unknown): StaleReason {
  if (error instanceof FetchTableError) {
    return error.reason;
  }
  if (error instanceof UnsafeFetchTargetError) {
    return "unknown";
  }
  const message = describeError(error);
  if (
    /UND_ERR_CONNECT_TIMEOUT|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EPIPE|fetch failed|请求失败|请求超时|TLS|socket/iu.test(
      message
    )
  ) {
    return "network";
  }
  return "unknown";
}

/** 当前 stale 表数量。 */
export function countStale(health: HealthFile): number {
  let count = 0;
  for (const table of health.tables.values()) {
    if (table.status === "stale") {
      count += 1;
    }
  }
  return count;
}
