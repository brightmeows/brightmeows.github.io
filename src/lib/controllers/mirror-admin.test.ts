import { describe, expect, it } from "vitest";

import {
  collapseAdminEdit,
  initialMirrorAdminState,
  loadOverviewIfNeeded,
  openAdminEdit,
  runAdminAction,
  toggleAdminEdit,
  type MirrorAdminDeps,
} from "./mirror-admin";

import type { AdminOverview } from "$lib/data/mirror-admin-api";

/**
 * 管理区状态转移的行为锁定测试：每条路径对应页面内实现的一条分支
 * （总览缓存决策、写操作串行外壳、编辑卡展开）。改语义前先确认
 * 这不是在改对外行为。
 */

const overview: AdminOverview = {
  counts: {
    authorized: 1,
    disabled: 0,
    replace: 0,
    meta: 0,
    added: 0,
    removed: 0,
    trash: 0,
  },
  authorized: [],
  disabled: [],
  replace: [],
  meta: [],
  added: [],
  removed: [],
  audit: [],
  trash: [],
};

function makeDeps(error?: Error): MirrorAdminDeps & { getCalls: () => number } {
  let calls = 0;
  const deps: MirrorAdminDeps & { getCalls: () => number } = {
    fetchOverview: () => {
      calls += 1;
      if (error) return Promise.reject(error);
      return Promise.resolve(overview);
    },
    getCalls: () => calls,
  };
  return deps;
}

describe("loadOverviewIfNeeded 总览缓存决策", () => {
  it("idle 首次加载进入 ready 并带数据", async () => {
    const deps = makeDeps();
    const state = await loadOverviewIfNeeded(initialMirrorAdminState(), deps);
    expect(state.overviewState).toBe("ready");
    expect(state.overview).toBe(overview);
    expect(state.overviewError).toBeNull();
    expect(deps.getCalls()).toBe(1);
  });

  it("已有数据且未强制：不重复请求", async () => {
    const deps = makeDeps();
    const ready = await loadOverviewIfNeeded(initialMirrorAdminState(), deps);
    const again = await loadOverviewIfNeeded(ready, deps);
    expect(again).toBe(ready);
    expect(deps.getCalls()).toBe(1);
  });

  it("强制刷新绕过缓存", async () => {
    const deps = makeDeps();
    const ready = await loadOverviewIfNeeded(initialMirrorAdminState(), deps);
    await loadOverviewIfNeeded(ready, deps, true);
    expect(deps.getCalls()).toBe(2);
  });

  it("加载中不叠加请求", async () => {
    const deps = makeDeps();
    const loading = { ...initialMirrorAdminState(), overviewState: "loading" as const };
    const state = await loadOverviewIfNeeded(loading, deps);
    expect(state).toBe(loading);
    expect(deps.getCalls()).toBe(0);
  });

  it("无数据时失败进入 error 并记错误", async () => {
    const state = await loadOverviewIfNeeded(initialMirrorAdminState(), makeDeps(new Error("x")));
    expect(state.overviewState).toBe("error");
    expect(state.overviewError).toBe("x");
    expect(state.overview).toBeNull();
  });

  it("有数据时失败保持 ready（旧数据仍可用）并记错误", async () => {
    const deps = makeDeps();
    const ready = await loadOverviewIfNeeded(initialMirrorAdminState(), deps);
    deps.fetchOverview = () => Promise.reject(new Error("y"));
    const state = await loadOverviewIfNeeded(ready, deps, true);
    expect(state.overviewState).toBe("ready");
    expect(state.overview).toBe(overview);
    expect(state.overviewError).toBe("y");
  });
});

describe("编辑卡展开", () => {
  it("toggle：同表再点收起、异表切换、展开时加载总览", async () => {
    const deps = makeDeps();
    const base = initialMirrorAdminState();
    const opened = await toggleAdminEdit(base, deps, "u1");
    expect(opened.expandedUrl).toBe("u1");
    expect(opened.overviewState).toBe("ready");
    const switched = await toggleAdminEdit(opened, deps, "u2");
    expect(switched.expandedUrl).toBe("u2");
    const closed = await toggleAdminEdit(opened, deps, "u1");
    expect(closed.expandedUrl).toBeNull();
  });

  it("open 幂等：已展开时保持展开", async () => {
    const deps = makeDeps();
    const opened = await toggleAdminEdit(initialMirrorAdminState(), deps, "u1");
    const kept = await openAdminEdit(opened, deps, "u1");
    expect(kept.expandedUrl).toBe("u1");
  });

  it("collapse：只收起匹配的表", () => {
    const state = { ...initialMirrorAdminState(), expandedUrl: "u1" };
    expect(collapseAdminEdit(state, "u2")).toBe(state);
    expect(collapseAdminEdit(state, "u1").expandedUrl).toBeNull();
  });
});

describe("runAdminAction 写操作串行外壳", () => {
  it("成功：设 ok 提示并返回 true", async () => {
    let ran = false;
    const result = await runAdminAction(
      initialMirrorAdminState(),
      () => {
        ran = true;
        return Promise.resolve();
      },
      "已保存"
    );
    expect(ran).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.state.busy).toBe(false);
    expect(result.state.notice).toEqual({ kind: "ok", text: "已保存" });
  });

  it("失败：翻译错误消息并返回 false", async () => {
    const result = await runAdminAction(
      initialMirrorAdminState(),
      () => Promise.reject(new Error("boom")),
      "ok"
    );
    expect(result.ok).toBe(false);
    expect(result.state.notice).toEqual({ kind: "error", text: "boom" });
    expect(result.state.busy).toBe(false);
  });

  it("忙时拒绝：状态不变、动作不执行", async () => {
    let ran = false;
    const busy = { ...initialMirrorAdminState(), busy: true };
    const result = await runAdminAction(
      busy,
      () => {
        ran = true;
        return Promise.resolve();
      },
      "ok"
    );
    expect(result.ok).toBe(false);
    expect(ran).toBe(false);
    expect(result.state).toBe(busy);
  });

  it("动作前置空提示，非 Error 值回落通用文案", async () => {
    const withNotice = {
      ...initialMirrorAdminState(),
      notice: { kind: "ok" as const, text: "旧" },
    };
    const result = await runAdminAction(withNotice, () => Promise.resolve(), "ok");
    expect(result.state.notice).toEqual({ kind: "ok", text: "ok" });
    // 动作前置空提示：上面的 withNotice 带旧提示，成功后应为新 ok 文案
    const failed = await runAdminAction(withNotice, () => Promise.reject(new Error("boom")), "ok");
    expect(failed.state.notice).toEqual({ kind: "error", text: "boom" });
  });
});
