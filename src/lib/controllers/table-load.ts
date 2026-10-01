/**
 * 搜索页共用的表加载状态机词汇：状态构造器、进度换算、错误分类与
 * 搜索代际（epoch）守卫。
 *
 * 单搜与批量搜两个页面（src/routes/bms/table/search/）原先各自复制
 * 这套构造器与判定；本模块是唯一来源，语义由 table-load.test.ts 锁定
 * （与 2026-10 之前的页面内实现逐字段一致）。页面保留各自的增量
 * 响应式流程，只从这里取状态与决策。
 */

import type { TableLoadState } from "$lib/data/bms-search";
import { m } from "$lib/paraglide/messages.js";

// ---- 状态构造器 ----

export function waitingState(tableId: string): TableLoadState {
  return { status: "waiting", tableId };
}

export function loadingHeaderState(tableId: string, name: string): TableLoadState {
  return { status: "loading-header", tableId, name };
}

export function loadingDataState(
  tableId: string,
  name: string,
  progress: number,
  bytesLoaded: number,
  bytesTotal: number
): TableLoadState {
  return { status: "loading-data", tableId, name, progress, bytesLoaded, bytesTotal };
}

export function parsingState(tableId: string, name: string): TableLoadState {
  return { status: "parsing", tableId, name };
}

export function doneState(tableId: string, name: string): TableLoadState {
  return { status: "done", tableId, name };
}

export function errorState(tableId: string, name: string, errorMessage: string): TableLoadState {
  return { status: "error", tableId, name, errorMessage };
}

// ---- 决策函数 ----

/** 下载进度换算：总量未知为 0，封顶 100。 */
export function progressPercent(loaded: number, total: number): number {
  return total > 0 ? Math.min(Math.round((loaded / total) * 100), 100) : 0;
}

/** 展示名回退：状态尚无名字（waiting/loading-header 前）时用表 id。 */
export function tableDisplayName(state: TableLoadState | undefined, fallback: string): string {
  return state !== undefined && "name" in state ? state.name : fallback;
}

/** 加载错误分类：取消静默返回，失败翻译消息（非 Error 回落通用文案）。 */
export type LoadErrorKind = { kind: "aborted" } | { kind: "failed"; message: string };

export function classifyLoadError(error: unknown): LoadErrorKind {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { kind: "aborted" };
  }
  return {
    kind: "failed",
    message: error instanceof Error ? error.message : m["common.unknown_error"](),
  };
}

// ---- 搜索代际守卫 ----

/**
 * 搜索代际守卫：新搜索使旧代际全部失效（异步回调按代际号自检后再写状态，
 * 防止被取代的搜索回写界面）。闭包持有当前代际，无运行时依赖。
 */
export interface EpochGuard {
  /** 开启新一代并返回其代际号。 */
  next(): number;
  /** 当前代际号（重试等留在本代内的操作用，不推进代际）。 */
  current(): number;
  /** 代际号是否仍是当前代。 */
  isCurrent(epoch: number): boolean;
}

export function createEpochGuard(): EpochGuard {
  let current = 0;
  return {
    next: () => {
      current += 1;
      return current;
    },
    current: () => current,
    isCurrent: (epoch: number) => epoch === current,
  };
}
