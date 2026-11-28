import { formatBytes } from "./format.js";

import { PROGRESS_DETERMINATE_MIN_BYTES } from "#lib/constants/progress.js";

/** 下载进度的原始字节计数；total 为 0 表示响应没有可用的总量。 */
export interface DownloadProgress {
  loaded: number;
  total: number;
}

/** 进度条展示决策：确定态、百分比与原始计数。 */
export interface ProgressView extends DownloadProgress {
  determinate: boolean;
  percent: number;
}

/** 索引组聚合所需的单文件字段。 */
export interface ProgressItemBytes {
  loaded: number;
  totalBytes: number;
  sizeBytes: number;
}

/** 聚合后的下载量；任一文件总量未知时 total 为 0。 */
export interface AggregateDownloadProgress extends DownloadProgress {
  sizeBytes: number;
}

function safeBytes(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * 把原始计数换算成进度条视图。
 *
 * 只有总量已知、达到小文件阈值且未超过声明总量时才进入确定态；
 * 越界通常是压缩或声明不一致，继续显示百分比会误导。
 */
export function progressView(
  loaded: number,
  total: number,
  minBytes = PROGRESS_DETERMINATE_MIN_BYTES
): ProgressView {
  const safeLoaded = safeBytes(loaded);
  const safeTotal = safeBytes(total);
  const determinate = safeTotal >= minBytes && safeLoaded <= safeTotal;
  return {
    loaded: safeLoaded,
    total: safeTotal,
    determinate,
    percent: determinate ? Math.min(Math.round((safeLoaded / safeTotal) * 100), 100) : 0,
  };
}

/** 详情文案：总量可用时显示 x / y，否则只显示已下载字节。 */
export function progressDetail(loaded: number, total: number): string {
  const safeLoaded = safeBytes(loaded);
  const safeTotal = safeBytes(total);
  if (safeTotal > 0 && safeLoaded <= safeTotal) {
    return `${formatBytes(safeLoaded)} / ${formatBytes(safeTotal)}`;
  }
  return formatBytes(safeLoaded);
}

/**
 * 聚合一组文件的下载量。
 *
 * 任一文件没有可用总量或已加载量超过声明总量时聚合总量置 0，避免把未知
 * 文件漏掉后假装确定；sizeBytes 始终累加，供无总量时显示已知文件大小。
 */
export function aggregateDownloadProgress(
  items: readonly ProgressItemBytes[]
): AggregateDownloadProgress {
  let loaded = 0;
  let total = 0;
  let sizeBytes = 0;
  let allTotalsKnown = items.length > 0;
  for (const item of items) {
    loaded += safeBytes(item.loaded);
    sizeBytes += safeBytes(item.sizeBytes);
    const itemTotal = safeBytes(item.totalBytes);
    if (itemTotal > 0 && safeBytes(item.loaded) <= itemTotal) {
      total += itemTotal;
    } else {
      allTotalsKnown = false;
    }
  }
  return { loaded, total: allTotalsKnown ? total : 0, sizeBytes };
}
