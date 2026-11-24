import { describe, expect, it } from "vitest";

import { FetchTableError } from "./fetch.ts";
import {
  buildHealthState,
  classifyFetchError,
  countStale,
  initialHealthState,
  parseHealthFile,
  serializeHealthFile,
  shouldRecheck,
  STALE_AFTER_MS,
  type FetchOutcome,
  type HealthFile,
  type TableHealth,
} from "./health.ts";
import type { SyncState } from "./state.ts";

const URL_A = "https://example.com/a/table.html";
const URL_B = "https://example.com/b/table.html";
const NOW = new Date("2026-11-24T00:00:00.000Z");
const NOW_ISO = NOW.toISOString();

function stateWith(entries: [string, string][]): SyncState {
  return {
    lastSync: "2026-11-01T00:00:00.000Z",
    tables: new Map(
      entries.map(([url, lastChange]) => [
        url,
        {
          lastCheck: "2026-11-01T00:00:00.000Z",
          lastChange,
          hashes: { info: "i", header: "h", data: "d" },
        },
      ])
    ),
  };
}

function healthFile(tables: [string, TableHealth][]): HealthFile {
  return { generatedAt: NOW_ISO, tables: new Map(tables) };
}

function okHealth(lastSuccess = "2026-11-20T00:00:00.000Z"): TableHealth {
  return {
    status: "ok",
    lastSuccess,
    lastAttempt: "2026-11-23T00:00:00.000Z",
    consecutiveFailures: 0,
  };
}

describe("initialHealthState", () => {
  it("按 seed 标记终态死表，其余表保留 state 的最后更新时间", () => {
    const overjoy = "http://lr2.sakura.ne.jp/overjoy.php";
    const health = initialHealthState({
      previous: null,
      state: stateWith([
        [overjoy, "2026-06-12T21:44:59.000Z"],
        [URL_A, "2026-11-01T00:00:00.000Z"],
      ]),
      activeUrls: new Set([overjoy, URL_A]),
      now: NOW,
    });

    expect(health.tables.get(overjoy)).toMatchObject({
      status: "stale",
      lastSuccess: "2026-06-12T21:44:59.000Z",
      lastAttempt: NOW_ISO,
      consecutiveFailures: 2,
      reason: "source_gone",
    });
    expect(health.tables.get(URL_A)).toMatchObject({
      status: "ok",
      lastSuccess: "2026-11-01T00:00:00.000Z",
      lastAttempt: NOW_ISO,
      consecutiveFailures: 0,
    });
  });

  it("保留已有健康记录，只补新增表", () => {
    const previous = healthFile([[URL_A, okHealth()]]);
    const health = initialHealthState({
      previous,
      state: stateWith([[URL_A, "2026-11-01T00:00:00.000Z"]]),
      activeUrls: new Set([URL_A, URL_B]),
      now: NOW,
    });

    expect(health.tables.get(URL_A)).toEqual(okHealth());
    expect(health.tables.get(URL_B)).toMatchObject({ status: "ok" });
  });
});

describe("buildHealthState", () => {
  it("终态错误连续两轮进入 stale", () => {
    const first = buildHealthState(
      healthFile([[URL_A, okHealth()]]),
      new Map([[URL_A, { kind: "failed", reason: "source_gone" }]]),
      NOW,
      new Map([[URL_A, "2026-11-20T00:00:00.000Z"]])
    );
    expect(first.tables.get(URL_A)).toMatchObject({
      status: "ok",
      consecutiveFailures: 1,
      firstFailureAt: NOW_ISO,
    });

    const second = buildHealthState(
      first,
      new Map([[URL_A, { kind: "failed", reason: "source_gone" }]]),
      new Date(NOW.getTime() + 6 * 60 * 60 * 1000),
      new Map([[URL_A, "2026-11-20T00:00:00.000Z"]])
    );
    expect(second.tables.get(URL_A)).toMatchObject({
      status: "stale",
      reason: "source_gone",
      consecutiveFailures: 2,
    });
  });

  it("瞬时错误连续七天进入 stale", () => {
    const first = buildHealthState(
      healthFile([[URL_A, okHealth()]]),
      new Map([[URL_A, { kind: "failed", reason: "network" }]]),
      NOW,
      new Map([[URL_A, "2026-11-20T00:00:00.000Z"]])
    );
    expect(first.tables.get(URL_A)?.status).toBe("ok");

    const later = buildHealthState(
      first,
      new Map([[URL_A, { kind: "failed", reason: "network" }]]),
      new Date(NOW.getTime() + STALE_AFTER_MS + 1000),
      new Map([[URL_A, "2026-11-20T00:00:00.000Z"]])
    );
    expect(later.tables.get(URL_A)).toMatchObject({
      status: "stale",
      reason: "network",
    });
  });

  it("成功抓取重置失败计数并写最后更新时间", () => {
    const stale: TableHealth = {
      status: "stale",
      lastSuccess: "2026-06-12T21:44:59.000Z",
      lastAttempt: "2026-11-20T00:00:00.000Z",
      consecutiveFailures: 3,
      firstFailureAt: "2026-11-10T00:00:00.000Z",
      reason: "source_gone",
    };
    const result = buildHealthState(
      healthFile([[URL_A, stale]]),
      new Map([[URL_A, { kind: "ok" }]]),
      NOW,
      new Map([[URL_A, "2026-11-24T00:00:00.000Z"]])
    );
    expect(result.tables.get(URL_A)).toEqual({
      status: "ok",
      lastSuccess: "2026-11-24T00:00:00.000Z",
      lastAttempt: NOW_ISO,
      consecutiveFailures: 0,
    });
  });

  it("跳过项保持原样", () => {
    const stale: TableHealth = {
      status: "stale",
      lastSuccess: "2026-06-12T21:44:59.000Z",
      lastAttempt: "2026-11-01T00:00:00.000Z",
      consecutiveFailures: 2,
      reason: "source_gone",
    };
    const result = buildHealthState(
      healthFile([[URL_A, stale]]),
      new Map<string, FetchOutcome>([[URL_A, { kind: "skipped" }]]),
      NOW,
      new Map()
    );
    expect(result.tables.get(URL_A)).toEqual(stale);
  });
});

describe("shouldRecheck", () => {
  it("stale 表满 30 天才复查", () => {
    const stale: TableHealth = {
      status: "stale",
      lastAttempt: "2026-10-01T00:00:00.000Z",
      consecutiveFailures: 2,
      reason: "source_gone",
    };
    expect(shouldRecheck(stale, new Date("2026-10-30T00:00:00.000Z"))).toBe(false);
    expect(shouldRecheck(stale, new Date("2026-10-31T00:00:00.000Z"))).toBe(true);
    expect(shouldRecheck(okHealth(), NOW)).toBe(true);
  });
});

describe("health.json 序列化与解析", () => {
  it("往返保持状态、时间与原因", () => {
    const health = healthFile([
      [
        URL_A,
        {
          status: "stale",
          lastSuccess: "2026-06-12T21:44:59.000Z",
          lastAttempt: "2026-11-01T00:00:00.000Z",
          consecutiveFailures: 2,
          firstFailureAt: "2026-10-01T00:00:00.000Z",
          reason: "source_gone",
        },
      ],
      [URL_B, { status: "ok", lastAttempt: NOW_ISO, consecutiveFailures: 0 }],
    ]);
    expect(parseHealthFile(serializeHealthFile(health))).toEqual(health);
  });

  it("坏输入返回 null", () => {
    expect(parseHealthFile("not json")).toBeNull();
    expect(parseHealthFile('{"generated_at":"x"}')).toBeNull();
  });
});

describe("classifyFetchError", () => {
  it("优先使用 FetchTableError 的分类", () => {
    expect(classifyFetchError(new FetchTableError("x", "gas_runtime_retired"))).toBe(
      "gas_runtime_retired"
    );
  });

  it("网络错误归为 network，其余归为 unknown", () => {
    expect(
      classifyFetchError(
        new Error("请求失败：https://example.com（fetch failed；cause=UND_ERR_CONNECT_TIMEOUT）")
      )
    ).toBe("network");
    expect(classifyFetchError(new Error("别的错误"))).toBe("unknown");
  });
});

describe("countStale", () => {
  it("统计 stale 条目", () => {
    const health = healthFile([
      [
        URL_A,
        {
          status: "stale",
          lastAttempt: NOW_ISO,
          consecutiveFailures: 2,
          reason: "source_gone",
        },
      ],
      [URL_B, okHealth()],
    ]);
    expect(countStale(health)).toBe(1);
  });
});
