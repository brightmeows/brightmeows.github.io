/**
 * 块窗口的纯计算：块大小、窗口范围、块高度前缀和与滚动偏移定位。
 * 组件只负责测量与渲染，边界计算集中在这里，便于单测固定。
 */

/** 块窗口范围，左闭右开。 */
export interface BlockWindowRange {
  start: number;
  end: number;
}

/** 按总行数与块大小计算块数。 */
export function countBlocks(totalRows: number, blockSize: number): number {
  if (!Number.isFinite(totalRows) || !Number.isFinite(blockSize)) return 0;
  if (totalRows <= 0 || blockSize <= 0) return 0;
  return Math.ceil(totalRows / blockSize);
}

/** 以当前块为中心计算窗口范围，窗口尽量保持 windowSize 块。 */
export function windowRange(
  currentBlock: number,
  totalBlocks: number,
  windowSize: number
): BlockWindowRange {
  if (
    !Number.isFinite(currentBlock) ||
    !Number.isFinite(totalBlocks) ||
    !Number.isFinite(windowSize)
  ) {
    return { start: 0, end: 0 };
  }
  if (totalBlocks <= 0 || windowSize <= 0) return { start: 0, end: 0 };
  const size = Math.min(Math.max(1, Math.floor(windowSize)), totalBlocks);
  const current = Math.min(Math.max(0, Math.floor(currentBlock)), totalBlocks - 1);
  const half = Math.floor(size / 2);
  let start = Math.max(0, current - half);
  const end = Math.min(totalBlocks, start + size);
  start = Math.max(0, end - size);
  return { start, end };
}

/** 生成块高度前缀和，offsets[i] 是第 i 块的起始偏移，长度比块数多一。 */
export function blockOffsets(blockHeights: readonly number[]): number[] {
  const offsets: number[] = [0];
  for (const [index, height] of blockHeights.entries()) {
    const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
    offsets[index + 1] = (offsets[index] ?? 0) + safeHeight;
  }
  return offsets;
}

/** 按滚动偏移找当前块，二分查找前缀和；空列表返回 0。 */
export function blockAtOffset(blockHeights: readonly number[], offset: number): number {
  if (blockHeights.length === 0) return 0;
  const offsets = blockOffsets(blockHeights);
  const target = Number.isFinite(offset) ? Math.max(0, offset) : 0;
  let low = 0;
  let high = blockHeights.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((offsets[mid] ?? 0) <= target) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** 求块区间 [start, end) 的高度和，区间自动钳制到有效范围。 */
export function sumBlockHeights(
  blockHeights: readonly number[],
  start: number,
  end: number
): number {
  const offsets = blockOffsets(blockHeights);
  const from = Math.max(0, Math.min(Math.floor(start), blockHeights.length));
  const to = Math.max(from, Math.min(Math.floor(end), blockHeights.length));
  return (offsets[to] ?? 0) - (offsets[from] ?? 0);
}

/**
 * 块高度测量后的锚点补偿：保持当前块起点不变，返回需要加到 scrollTop 的增量。
 * 当前块自身高度变化不改变它的起点，返回 0。
 */
export function anchorScrollDelta(
  before: readonly number[],
  after: readonly number[],
  currentBlock: number
): number {
  const length = Math.min(before.length, after.length);
  if (length === 0) return 0;
  const index = Math.min(Math.max(0, Math.floor(currentBlock)), length);
  const beforeOffsets = blockOffsets(before);
  const afterOffsets = blockOffsets(after);
  return (afterOffsets[index] ?? 0) - (beforeOffsets[index] ?? 0);
}
