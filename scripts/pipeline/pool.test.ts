import { describe, expect, it } from "vitest";

import { mapPool } from "./pool.ts";

describe("mapPool", () => {
  it("保持结果顺序并限制并发", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return item * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("空输入返回空数组", async () => {
    expect(await mapPool([], 4, (item) => Promise.resolve(item))).toEqual([]);
  });
});
