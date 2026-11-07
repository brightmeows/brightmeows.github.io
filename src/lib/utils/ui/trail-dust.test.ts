import { describe, expect, it } from "vitest";

import {
  DUST_DRIFT,
  DUST_INHERIT,
  DUST_LIFE_MS,
  DUST_MAX,
  DUST_PEAK_ALPHA,
  DUST_RADIUS,
  DUST_SPAWN_DISTANCE,
  capDust,
  createDust,
  dustAlphaAt,
  dustProgress,
  dustRadiusAt,
  dustSpawnCount,
  isDustAlive,
  pruneDust,
  updateDust,
  type Dust,
} from "./trail-dust";

/** 确定性 rng：按序列循环返回预设值（循环索引由取模保证界内） */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("createDust", () => {
  it("rng 全 0 时落在各域下界：漂移取负界、寿命 0.75 倍、半径 0.7 倍、相位 0、频率 2", () => {
    const dust = createDust(100, 200, 500, -300, 1000, seqRng([0]));
    expect(dust.x).toBe(100 - 2);
    expect(dust.y).toBe(200 - 2);
    expect(dust.vx).toBeCloseTo(500 * DUST_INHERIT - DUST_DRIFT);
    expect(dust.vy).toBeCloseTo(-300 * DUST_INHERIT - DUST_DRIFT);
    expect(dust.life).toBeCloseTo(DUST_LIFE_MS * 0.75);
    expect(dust.size).toBeCloseTo(DUST_RADIUS * 0.7);
    expect(dust.phase).toBe(0);
    expect(dust.frequency).toBeCloseTo(2);
  });

  it("rng 全 1 时落在各域上界：漂移取正界、寿命 1.25 倍、相位为全角", () => {
    const dust = createDust(0, 0, 0, 0, 1000, seqRng([1]));
    expect(dust.vx).toBeCloseTo(DUST_DRIFT);
    expect(dust.life).toBeCloseTo(DUST_LIFE_MS * 1.25);
    expect(dust.phase).toBeCloseTo(Math.PI * 2);
    expect(dust.frequency).toBeCloseTo(5);
  });
});

describe("dustSpawnCount", () => {
  it("不足撒尘间距时只累计余量，不撒尘", () => {
    expect(dustSpawnCount(0, DUST_SPAWN_DISTANCE - 0.1)).toEqual({
      remainder: DUST_SPAWN_DISTANCE - 0.1,
      count: 0,
    });
  });

  it("恰好达到间距时撒一粒并清空余量", () => {
    expect(dustSpawnCount(0, DUST_SPAWN_DISTANCE)).toEqual({ remainder: 0, count: 1 });
  });

  it("单次长距离按间距拆成多粒，余量保留", () => {
    expect(dustSpawnCount(0, DUST_SPAWN_DISTANCE * 2 + 4)).toEqual({ remainder: 4, count: 2 });
  });

  it("余量跨事件累计：余差 1 再走 2 即撒一粒", () => {
    expect(dustSpawnCount(DUST_SPAWN_DISTANCE - 1, 2)).toEqual({ remainder: 1, count: 1 });
  });
});

describe("updateDust", () => {
  it("位置按速度积分，速度按指数衰减", () => {
    const dust: Dust = {
      x: 0,
      y: 0,
      vx: 100,
      vy: 0,
      born: 0,
      life: 1000,
      size: 2,
      phase: 0,
      frequency: 2,
    };
    updateDust(dust, 0.1);
    expect(dust.x).toBeCloseTo(100 * 0.1);
    expect(dust.vx).toBeCloseTo(100 * Math.exp(-1.8 * 0.1));
  });
});

describe("dustProgress / isDustAlive", () => {
  it("进度为年龄与寿命之比", () => {
    const dust = createDust(0, 0, 0, 0, 1000, seqRng([0.5]));
    expect(dustProgress(dust, 1000)).toBe(0);
    expect(dustProgress(dust, 1000 + dust.life / 2)).toBeCloseTo(0.5);
  });

  it("寿命内存活，到期即亡", () => {
    const dust = createDust(0, 0, 0, 0, 1000, seqRng([0.5]));
    expect(isDustAlive(dust, 1000 + dust.life - 1)).toBe(true);
    expect(isDustAlive(dust, 1000 + dust.life)).toBe(false);
  });
});

describe("dustAlphaAt", () => {
  it("透明度不越过峰值档：任意相位与年龄都在 0 与峰值之间", () => {
    for (const value of [0, 0.2, 0.5, 0.8, 1]) {
      const dust = createDust(0, 0, 0, 0, 0, seqRng([value]));
      for (let now = 0; now <= DUST_LIFE_MS * 1.25; now += 25) {
        const alpha = dustAlphaAt(dust, now);
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThanOrEqual(DUST_PEAK_ALPHA);
      }
    }
  });

  it("寿命终点包络归零：闪烁项不再贡献透明度", () => {
    const dust = createDust(0, 0, 0, 0, 0, seqRng([0.25]));
    expect(dustAlphaAt(dust, dust.life)).toBe(0);
  });

  it("出生瞬间可达到峰值：相位取闪烁上界时等于峰值档", () => {
    // rng 0.25 使相位落在 π/2，出生时刻闪烁项为上界 1
    const dust = createDust(0, 0, 0, 0, 0, seqRng([0.25]));
    expect(dustAlphaAt(dust, 0)).toBeCloseTo(DUST_PEAK_ALPHA);
  });
});

describe("dustRadiusAt", () => {
  it("出生为完整半径，寿命终点收缩到六成半", () => {
    const dust = createDust(0, 0, 0, 0, 0, seqRng([0.5]));
    expect(dustRadiusAt(dust, 0)).toBeCloseTo(dust.size);
    expect(dustRadiusAt(dust, dust.life)).toBeCloseTo(dust.size * 0.65);
  });
});

describe("pruneDust / capDust", () => {
  it("清理到期尘粒，保留存活序列", () => {
    // rng 全 0 取寿命下界 0.75 倍：born 0 的尘粒在 600ms 已到期
    const dead = createDust(0, 0, 0, 0, 0, seqRng([0]));
    const alive = createDust(0, 0, 0, 0, 500, seqRng([0]));
    const kept = pruneDust([dead, alive], 600);
    expect(kept).toEqual([alive]);
  });

  it("超出上限时丢弃最旧的尘粒", () => {
    const oldest = createDust(0, 0, 0, 0, 1, seqRng([0.5]));
    const middle = createDust(0, 0, 0, 0, 2, seqRng([0.5]));
    const newest = createDust(0, 0, 0, 0, 3, seqRng([0.5]));
    expect(capDust([oldest, middle, newest], 2)).toEqual([middle, newest]);
  });

  it("未超上限时原样返回", () => {
    const dust = [createDust(0, 0, 0, 0, 1, seqRng([0.5]))];
    expect(capDust(dust, DUST_MAX)).toBe(dust);
  });
});
