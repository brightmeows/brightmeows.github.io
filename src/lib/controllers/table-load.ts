/**
 * 搜索页共用的表加载状态机词汇：状态构造器、进度换算、错误分类与
 * 搜索代际（epoch）守卫。
 *
 * 单搜与批量搜两个页面（src/routes/bms/table/search/）原先各自复制
 * 这套构造器与判定；本模块是唯一来源，语义由 table-load.test.ts 锁定
 * （与 2026-10 之前的页面内实现逐字段一致）。页面保留各自的增量
 * 响应式流程，只从这里取状态与决策。
 */

import type { ChartData } from "@brightmeows/bms/format";

import type { TableLoadState } from "#lib/data/api/bms-search.js";
import { m } from "#lib/paraglide/messages.js";

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

// ---- 单表加载骨架 ----

/** 单表加载的页面交接面：代际、状态读写与取消信号（控制器不触 Svelte 运行时，读写经注入）。 */
export interface TableLoadIo {
  /** 本代是否仍有效（页面闭包各自捕获代际号）。 */
  isEpochValid: () => boolean;
  /** 读当前状态（错误路径回退表名用）。 */
  getState: (tableId: string) => TableLoadState | undefined;
  /** 写状态（页面 SvelteMap 的 set）。 */
  setState: (tableId: string, state: TableLoadState) => void;
  /** 取消信号（页面的 AbortController）。 */
  signal: AbortSignal | undefined;
}

/** 单表加载的页面差异点：两段取数与成功、失败副作用。 */
export interface TableLoadTasks {
  /** header 拉取（loadTableHeader 的表绑定；永不 reject，缺失返回 null）。 */
  loadHeader: (
    signal: AbortSignal | undefined
  ) => Promise<{ name: string; symbol: string | undefined } | null>;
  /** 数据段取数：单搜按 keySet 过滤，批量取全量。onProgress 已代际守卫并回写进度。 */
  loadCharts: (
    signal: AbortSignal | undefined,
    onProgress: (loaded: number, total: number) => void
  ) => Promise<ChartData[]>;
  /** 解析完成的页面副作用：单搜聚合回写，批量表数据缓存。 */
  onParsed: (
    tableId: string,
    name: string,
    symbol: string | undefined,
    charts: ChartData[]
  ) => void;
  /** 失败清理：单搜移除聚合器占位；批量页无此需要。 */
  onFailed?: (tableId: string) => void;
}

/**
 * 单表加载骨架：header、data、parsing、done 四相推进加错误分流，两搜索页
 * 共用（原为逐字平行的两份）。两处等价归并（行为不变）：进度回调的表名
 * 防御性重读在同代内恒等于捕获名；错误分支的 failed 判定在 aborted 提前
 * 返回后恒真（LoadErrorKind 只有两种）。调度语义不内置：串行 await 与
 * Promise.allSettled 并行由调用方控制。
 */
export async function runTableLoad(
  tableId: string,
  io: TableLoadIo,
  tasks: TableLoadTasks
): Promise<void> {
  io.setState(tableId, loadingHeaderState(tableId, tableId));
  try {
    const header = await tasks.loadHeader(io.signal);
    if (!io.isEpochValid()) return;

    const name = header?.name ?? tableId;
    const symbol = header?.symbol;

    io.setState(tableId, loadingDataState(tableId, name, 0, 0, 0));

    const charts = await tasks.loadCharts(io.signal, (loaded, total) => {
      if (!io.isEpochValid()) return;
      io.setState(
        tableId,
        loadingDataState(tableId, name, progressPercent(loaded, total), loaded, total)
      );
    });

    if (!io.isEpochValid()) return;

    io.setState(tableId, parsingState(tableId, name));
    tasks.onParsed(tableId, name, symbol, charts);
    io.setState(tableId, doneState(tableId, name));
  } catch (error) {
    const classified = classifyLoadError(error);
    if (classified.kind === "aborted") return;
    if (!io.isEpochValid()) return;

    tasks.onFailed?.(tableId);

    const name = tableDisplayName(io.getState(tableId), tableId);
    io.setState(tableId, errorState(tableId, name, classified.message));
  }
}
