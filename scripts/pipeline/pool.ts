/** 有界并发的批量 map：同一条队列由固定数量的 worker 消费。 */

/**
 * 以固定并发上限执行任务，保持结果顺序与输入一致。
 *
 * 旧实现无并发上限；这里按已确认的决策改为有界并发，把在途请求与内存
 * 峰值变成可控常数。
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      const item = items[index];
      if (item === undefined) {
        return;
      }
      results[index] = await task(item, index);
    }
  });
  await Promise.all(workers);
  return results;
}
