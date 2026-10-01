import { describe, expect, it } from "vitest";

import {
  classifyLoadError,
  createEpochGuard,
  doneState,
  errorState,
  loadingDataState,
  loadingHeaderState,
  parsingState,
  progressPercent,
  runTableLoad,
  tableDisplayName,
  waitingState,
  type TableLoadIo,
  type TableLoadTasks,
} from "./table-load";

import type { TableLoadState } from "$lib/data/bms-search";
import type { ChartData } from "$lib/types/bms-format";

/** 状态机构造器与决策函数的行为锁定测试（对应页面内原实现的字段形状）。 */

describe("状态构造器", () => {
  it("各状态携带对应字段", () => {
    expect(waitingState("t")).toEqual({ status: "waiting", tableId: "t" });
    expect(loadingHeaderState("t", "名")).toEqual({
      status: "loading-header",
      tableId: "t",
      name: "名",
    });
    expect(loadingDataState("t", "名", 40, 4, 10)).toEqual({
      status: "loading-data",
      tableId: "t",
      name: "名",
      progress: 40,
      bytesLoaded: 4,
      bytesTotal: 10,
    });
    expect(parsingState("t", "名")).toEqual({ status: "parsing", tableId: "t", name: "名" });
    expect(doneState("t", "名")).toEqual({ status: "done", tableId: "t", name: "名" });
    expect(errorState("t", "名", "boom")).toEqual({
      status: "error",
      tableId: "t",
      name: "名",
      errorMessage: "boom",
    });
  });
});

describe("决策函数", () => {
  it("进度换算：总量未知为 0、正常换算、封顶 100", () => {
    expect(progressPercent(3, 0)).toBe(0);
    expect(progressPercent(4, 10)).toBe(40);
    expect(progressPercent(12, 10)).toBe(100);
  });

  it("展示名回退：无名字的状态回落表 id", () => {
    expect(tableDisplayName(waitingState("t"), "t-id")).toBe("t-id");
    expect(tableDisplayName(loadingHeaderState("t", "名"), "t-id")).toBe("名");
    expect(tableDisplayName(undefined, "t-id")).toBe("t-id");
  });

  it("错误分类：取消静默，失败取 message，非 Error 回落通用文案", () => {
    expect(classifyLoadError(new DOMException("abort", "AbortError"))).toEqual({
      kind: "aborted",
    });
    const failed = classifyLoadError(new Error("boom"));
    expect(failed.kind).toBe("failed");
    if (failed.kind === "failed") expect(failed.message).toBe("boom");
    const junk = classifyLoadError("junk");
    expect(junk.kind).toBe("failed");
    if (junk.kind === "failed") expect(junk.message.length).toBeGreaterThan(0);
  });
});

describe("搜索代际守卫", () => {
  it("next 递增且旧代际失效；current 不推进", () => {
    const guard = createEpochGuard();
    const first = guard.next();
    expect(guard.isCurrent(first)).toBe(true);
    expect(guard.current()).toBe(first);
    const second = guard.next();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
    expect(guard.current()).toBe(second);
  });
});

// ---- runTableLoad 骨架 ----

/** 骨架测试的假交互面：内存状态映射加写入序列加代际开关。 */
function makeIo(epochValid: () => boolean): {
  io: TableLoadIo;
  states: Map<string, TableLoadState>;
  writes: TableLoadState[];
} {
  const states = new Map<string, TableLoadState>();
  const writes: TableLoadState[] = [];
  return {
    states,
    writes,
    io: {
      isEpochValid: epochValid,
      getState: (id) => states.get(id),
      setState: (id, state) => {
        states.set(id, state);
        writes.push(state);
      },
      signal: undefined,
    },
  };
}

function makeTasks(overrides: Partial<TableLoadTasks> = {}): {
  tasks: TableLoadTasks;
  parsed: { name: string; symbol: string | undefined; charts: ChartData[] }[];
  failed: string[];
} {
  const parsed: { name: string; symbol: string | undefined; charts: ChartData[] }[] = [];
  const failed: string[] = [];
  return {
    parsed,
    failed,
    tasks: {
      loadHeader: () => Promise.resolve({ name: "表名", symbol: "SY" }),
      loadCharts: () => Promise.resolve<ChartData[]>([]),
      onParsed: (_id, name, symbol, charts) => parsed.push({ name, symbol, charts }),
      onFailed: (id) => failed.push(id),
      ...overrides,
    },
  };
}

describe("runTableLoad 骨架", () => {
  it("顺利路径四相推进，onParsed 收到名字、symbol 与谱面", async () => {
    const { io, writes } = makeIo(() => true);
    const charts = [{ md5: "a" }] as unknown as ChartData[];
    const { tasks, parsed } = makeTasks({ loadCharts: () => Promise.resolve(charts) });

    await runTableLoad("t", io, tasks);

    expect(writes).toEqual([
      loadingHeaderState("t", "t"),
      loadingDataState("t", "表名", 0, 0, 0),
      parsingState("t", "表名"),
      doneState("t", "表名"),
    ]);
    expect(parsed).toEqual([{ name: "表名", symbol: "SY", charts }]);
  });

  it("header 缺失时表名回落表 id、symbol 为 undefined", async () => {
    const { io, states } = makeIo(() => true);
    const { tasks, parsed } = makeTasks({ loadHeader: () => Promise.resolve(null) });

    await runTableLoad("t", io, tasks);

    expect(states.get("t")).toEqual(doneState("t", "t"));
    expect(parsed[0]?.name).toBe("t");
    expect(parsed[0]?.symbol).toBeUndefined();
  });

  it("进度回调回写百分比，代际失效后的进度被忽略", async () => {
    let valid = true;
    const { io, states } = makeIo(() => valid);
    const { tasks } = makeTasks({
      loadCharts: (_signal, onProgress) => {
        onProgress(5, 10);
        valid = false; // 模拟下载途中被新搜索取代
        onProgress(9, 10);
        return Promise.resolve<ChartData[]>([]);
      },
    });

    await runTableLoad("t", io, tasks);

    // 失效后的进度不回写；最终停在代际失效前的最后状态（data 50%）
    expect(states.get("t")).toEqual(loadingDataState("t", "表名", 50, 5, 10));
  });

  it("header 之后代际失效即停，不写 parsing 与 done", async () => {
    let valid = true;
    const { io, states } = makeIo(() => valid);
    const { tasks, parsed } = makeTasks({
      loadHeader: () => {
        valid = false;
        return Promise.resolve({ name: "表名", symbol: undefined });
      },
    });

    await runTableLoad("t", io, tasks);

    expect(states.get("t")).toEqual(loadingHeaderState("t", "t"));
    expect(parsed).toEqual([]);
  });

  it("失败路径：先清理占位再写错误态，错误名从当前状态恢复", async () => {
    const { io, states } = makeIo(() => true);
    const { tasks, failed } = makeTasks({
      loadCharts: () => Promise.reject(new Error("boom")),
    });

    await runTableLoad("t", io, tasks);

    expect(failed).toEqual(["t"]);
    // 名字从 data 相状态恢复（header 已成功），不是表 id
    expect(states.get("t")).toEqual(errorState("t", "表名", "boom"));
  });

  it("header 阶段失败：名字回落表 id（此时状态仍是 loading-header）", async () => {
    const { io, states } = makeIo(() => true);
    const { tasks } = makeTasks({ loadHeader: () => Promise.reject(new Error("dns")) });

    await runTableLoad("t", io, tasks);

    expect(states.get("t")).toEqual(errorState("t", "t", "dns"));
  });

  it("AbortError 静默返回：不清理、不写错误态", async () => {
    const { io, states } = makeIo(() => true);
    const { tasks, failed } = makeTasks({
      loadCharts: () => Promise.reject(new DOMException("abort", "AbortError")),
    });

    await runTableLoad("t", io, tasks);

    expect(failed).toEqual([]);
    expect(states.get("t")).toEqual(loadingDataState("t", "表名", 0, 0, 0));
  });

  it("失败时代际已失效：不清理、不回写", async () => {
    let valid = true;
    const { io, states } = makeIo(() => valid);
    const { tasks, failed } = makeTasks({
      loadCharts: () => {
        valid = false;
        return Promise.reject(new Error("late"));
      },
    });

    await runTableLoad("t", io, tasks);

    expect(failed).toEqual([]);
    expect(states.get("t")).toEqual(loadingDataState("t", "表名", 0, 0, 0));
  });

  it("并行调用互不串扰（Promise.allSettled 场景：各持独立 io）", async () => {
    const first = makeIo(() => true);
    const second = makeIo(() => true);
    const firstTasks = makeTasks({
      loadHeader: () => Promise.resolve({ name: "甲", symbol: undefined }),
    });
    const secondTasks = makeTasks({
      loadHeader: () => Promise.resolve({ name: "乙", symbol: undefined }),
      loadCharts: (_signal, onProgress) => {
        // 乱序进度：后启动的表先进度更高，不得写进对方状态
        onProgress(8, 10);
        return Promise.resolve<ChartData[]>([]);
      },
    });

    await Promise.all([
      runTableLoad("t1", first.io, firstTasks.tasks),
      runTableLoad("t2", second.io, secondTasks.tasks),
    ]);

    expect(first.states.get("t1")).toEqual(doneState("t1", "甲"));
    expect(second.states.get("t2")).toEqual(doneState("t2", "乙"));
    expect(first.states.size).toBe(1);
    expect(second.states.size).toBe(1);
  });
});
