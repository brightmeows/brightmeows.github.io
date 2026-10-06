/**
 * 镜像列表页的管理编排：后台总览的加载与缓存决策、写操作的串行外壳、
 * 行内编辑卡的展开状态。
 *
 * 页面（src/routes/bms/table/mirror/+page.svelte）负责 confirm 弹窗、i18n
 * 文案与各动作的 API 调用序列（以回调交给 runAdminAction）；本模块持有
 * busy/notice/overview/expanded 的状态转移并集中错误翻译，语义由
 * mirror-admin.test.ts 锁定（与 2026-10 之前的页面内实现逐分支一致）。
 */

import type { AdminOverview } from "$lib/data/api/mirror-admin-api";
import { m } from "$lib/paraglide/messages.js";
import type { MirrorOverviewState } from "$lib/types/bms-view";

/** 管理区状态：页面以整体替换的方式更新（控制器返回新对象）。 */
export interface MirrorAdminState {
  /** 写操作串行中：忽略新点击。 */
  busy: boolean;
  overview: AdminOverview | null;
  overviewState: MirrorOverviewState;
  overviewError: string | null;
  /** 行内编辑卡展开的表（以清单 url 为键）。 */
  expandedUrl: string | null;
  notice: { kind: "ok" | "error"; text: string } | null;
}

export function initialMirrorAdminState(): MirrorAdminState {
  return {
    busy: false,
    overview: null,
    overviewState: "idle",
    overviewError: null,
    expandedUrl: null,
    notice: null,
  };
}

/** 管理取数依赖：页面传真实现（mirror-admin-api 与清单加载），单测传假实现。 */
export interface MirrorAdminDeps {
  fetchOverview(): Promise<AdminOverview>;
}

/** 错误文案：Error 取 message，其余用调用方指定的回落文案（与原页面一致：
 *  写操作回落 admin.action_failed，总览回落 common.unknown_error）。 */
function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * 后台总览的加载与缓存决策：
 * - 加载中直接返回（不叠加请求）；
 * - 已有数据且未强制时保持（写操作后的刷新由调用方传 force）；
 * - 失败时保留旧数据（有数据仍算 ready），没有数据才进入 error。
 */
export async function loadOverviewIfNeeded(
  state: MirrorAdminState,
  deps: MirrorAdminDeps,
  force = false
): Promise<MirrorAdminState> {
  if (!force && state.overview !== null) return state;
  if (state.overviewState === "loading") return state;
  const next: MirrorAdminState = { ...state, overviewState: "loading" };
  try {
    const overview = await deps.fetchOverview();
    return { ...next, overview, overviewState: "ready", overviewError: null };
  } catch (error) {
    const overviewError = errorText(error, m["common.unknown_error"]());
    return {
      ...next,
      overviewError,
      overviewState: state.overview === null ? "error" : "ready",
    };
  }
}

/** 行内编辑卡的展开切换：同表再点收起，展开时确保总览已加载。 */
export async function toggleAdminEdit(
  state: MirrorAdminState,
  deps: MirrorAdminDeps,
  url: string
): Promise<MirrorAdminState> {
  const expandedUrl = state.expandedUrl === url ? null : url;
  const next = { ...state, expandedUrl };
  if (expandedUrl !== null) {
    return loadOverviewIfNeeded(next, deps);
  }
  return next;
}

/** 幂等展开（授权图标点击用）：已展开时保持展开。 */
export async function openAdminEdit(
  state: MirrorAdminState,
  deps: MirrorAdminDeps,
  url: string
): Promise<MirrorAdminState> {
  return loadOverviewIfNeeded({ ...state, expandedUrl: url }, deps);
}

/** 收起指定表的编辑卡（该表被移出清单时用）。 */
export function collapseAdminEdit(state: MirrorAdminState, url: string): MirrorAdminState {
  if (state.expandedUrl !== url) return state;
  return { ...state, expandedUrl: null };
}

/**
 * 写操作的串行外壳：忙时拒绝；成功设 ok 提示，失败翻译错误并保留给
 * 界面展示。动作回调里的 API 调用与局部刷新由页面提供。
 */
export async function runAdminAction(
  state: MirrorAdminState,
  action: () => Promise<void>,
  okText: string
): Promise<{ state: MirrorAdminState; ok: boolean }> {
  if (state.busy) return { state, ok: false };
  const busy: MirrorAdminState = { ...state, busy: true, notice: null };
  try {
    await action();
    return { state: { ...busy, busy: false, notice: { kind: "ok", text: okText } }, ok: true };
  } catch (error) {
    return {
      state: {
        ...busy,
        busy: false,
        notice: { kind: "error", text: errorText(error, m["admin.action_failed"]()) },
      },
      ok: false,
    };
  }
}
