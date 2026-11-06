import { describe, expect, it } from "vitest";

import {
  RIPPLE_DURATION_MS,
  RIPPLE_MAX_RADIUS,
  RIPPLE_PEAK_ALPHA,
  SPARK_DRIFT,
  SPARK_INHERIT,
  SPARK_LIFE_MS,
  SPARK_MAX,
  SPARK_PEAK_ALPHA,
  SPARK_RADIUS,
  SPARK_SPAWN_DISTANCE,
  SPLASH_COUNT,
  SPLASH_SPEED_MAX,
  SPLASH_SPEED_MIN,
  TAP_MAX_DISTANCE,
  TAP_MAX_DURATION_MS,
  capSparks,
  createRipple,
  createSpark,
  createSplash,
  isRippleAlive,
  isSparkAlive,
  isTap,
  pruneRipples,
  pruneSparks,
  rippleAlphaAt,
  rippleRadiusAt,
  sparkAlphaAt,
  sparkProgress,
  sparkRadiusAt,
  sparkSpawnCount,
  updateSpark,
  type Spark,
} from "./pointer-fx";

/** 确定性 rng：按序列循环返回预设值（循环索引由取模保证界内） */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("createSpark", () => {
  it("rng 全 0 时落在各域下界：漂移取负界、寿命 0.75 倍、半径 0.7 倍、相位 0、频率 2", () => {
    const spark = createSpark(100, 200, 500, -300, 1000, seqRng([0]));
    expect(spark.x).toBe(100 - 2);
    expect(spark.y).toBe(200 - 2);
    expect(spark.vx).toBeCloseTo(500 * SPARK_INHERIT - SPARK_DRIFT);
    expect(spark.vy).toBeCloseTo(-300 * SPARK_INHERIT - SPARK_DRIFT);
    expect(spark.life).toBeCloseTo(SPARK_LIFE_MS * 0.75);
    expect(spark.size).toBeCloseTo(SPARK_RADIUS * 0.7);
    expect(spark.phase).toBe(0);
    expect(spark.frequency).toBeCloseTo(2);
  });

  it("rng 全 1 时落在各域上界：漂移取正界、寿命 1.25 倍、相位为全角", () => {
    const spark = createSpark(0, 0, 0, 0, 1000, seqRng([1]));
    expect(spark.vx).toBeCloseTo(SPARK_DRIFT);
    expect(spark.life).toBeCloseTo(SPARK_LIFE_MS * 1.25);
    expect(spark.phase).toBeCloseTo(Math.PI * 2);
    expect(spark.frequency).toBeCloseTo(5);
  });
});

describe("createSplash", () => {
  it("生成 SPLASH_COUNT 颗微粒，速度方向均匀、大小在阈值内", () => {
    const sparks = createSplash(10, 20, 1000, seqRng([0.1, 0.9, 0.5]));
    expect(sparks).toHaveLength(SPLASH_COUNT);
    for (const spark of sparks) {
      const speed = Math.hypot(spark.vx, spark.vy);
      expect(speed).toBeGreaterThanOrEqual(SPLASH_SPEED_MIN);
      expect(speed).toBeLessThanOrEqual(SPLASH_SPEED_MAX);
      expect(spark.x).toBe(10);
      expect(spark.y).toBe(20);
    }
  });
});

describe("updateSpark", () => {
  it("位置按速度积分，速度按指数衰减", () => {
    const spark: Spark = {
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
    updateSpark(spark, 0.1);
    expect(spark.x).toBeCloseTo(100 * 0.1);
    expect(spark.vx).toBeCloseTo(100 * Math.exp(-1.8 * 0.1));
  });
});

describe("sparkSpawnCount", () => {
  it("不足撒点间距时只累计余量，不撒点", () => {
    expect(sparkSpawnCount(0, SPARK_SPAWN_DISTANCE - 0.1)).toEqual({
      remainder: SPARK_SPAWN_DISTANCE - 0.1,
      count: 0,
    });
  });

  it("恰好达到间距时撒一颗并清空余量", () => {
    expect(sparkSpawnCount(0, SPARK_SPAWN_DISTANCE)).toEqual({ remainder: 0, count: 1 });
  });

  it("单次长距离按间距拆成多颗，余量保留", () => {
    expect(sparkSpawnCount(0, SPARK_SPAWN_DISTANCE * 2 + 4)).toEqual({ remainder: 4, count: 2 });
  });

  it("余量跨事件累计：余差 1 再走 2 即撒一颗", () => {
    expect(sparkSpawnCount(SPARK_SPAWN_DISTANCE - 1, 2)).toEqual({ remainder: 1, count: 1 });
  });
});

describe("sparkProgress / isSparkAlive", () => {
  const spark: Spark = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    born: 1000,
    life: SPARK_LIFE_MS,
    size: 2,
    phase: 0,
    frequency: 2,
  };

  it("出生时进度为 0，寿命终点为 1，越界后继续增长", () => {
    expect(sparkProgress(spark, 1000)).toBe(0);
    expect(sparkProgress(spark, 1000 + SPARK_LIFE_MS)).toBe(1);
    expect(sparkProgress(spark, 1000 + SPARK_LIFE_MS * 1.2)).toBe(1.2);
  });

  it("寿命内存活，终点即判死", () => {
    expect(isSparkAlive(spark, 1000 + SPARK_LIFE_MS - 1)).toBe(true);
    expect(isSparkAlive(spark, 1000 + SPARK_LIFE_MS)).toBe(false);
  });
});

describe("sparkAlphaAt", () => {
  const spark: Spark = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    born: 1000,
    life: SPARK_LIFE_MS,
    size: 2,
    phase: 0,
    frequency: 2,
  };

  it("任意时刻不超过峰值透明度，寿命终点归零", () => {
    for (let ms = 0; ms <= SPARK_LIFE_MS; ms += 25) {
      expect(sparkAlphaAt(spark, 1000 + ms)).toBeLessThanOrEqual(SPARK_PEAK_ALPHA);
    }
    expect(sparkAlphaAt(spark, 1000 + SPARK_LIFE_MS)).toBe(0);
  });

  it("闪烁项使透明度振荡：包络相同的不同时刻取值不同", () => {
    const early = sparkAlphaAt(spark, 1000);
    const later = sparkAlphaAt(spark, 1000 + SPARK_LIFE_MS * 0.25);
    expect(early).not.toBeCloseTo(later, 3);
  });
});

describe("sparkRadiusAt", () => {
  const spark: Spark = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    born: 1000,
    life: SPARK_LIFE_MS,
    size: SPARK_RADIUS,
    phase: 0,
    frequency: 2,
  };

  it("半径随寿命收缩到六成半", () => {
    expect(sparkRadiusAt(spark, 1000)).toBeCloseTo(SPARK_RADIUS);
    expect(sparkRadiusAt(spark, 1000 + SPARK_LIFE_MS)).toBeCloseTo(SPARK_RADIUS * 0.65);
  });
});

describe("pruneSparks / capSparks", () => {
  it("只保留寿命内的微粒", () => {
    const alive: Spark = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      born: 900,
      life: 500,
      size: 2,
      phase: 0,
      frequency: 2,
    };
    const dead: Spark = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      born: 100,
      life: 500,
      size: 2,
      phase: 0,
      frequency: 2,
    };
    expect(pruneSparks([alive, dead], 1000)).toEqual([alive]);
  });

  it("超上限时丢弃最旧的，未超上限原样返回", () => {
    const points = [
      { x: 0, y: 0, vx: 0, vy: 0, born: 0, life: 500, size: 2, phase: 0, frequency: 2 },
      { x: 1, y: 0, vx: 0, vy: 0, born: 1, life: 500, size: 2, phase: 0, frequency: 2 },
      { x: 2, y: 0, vx: 0, vy: 0, born: 2, life: 500, size: 2, phase: 0, frequency: 2 },
    ];
    expect(capSparks(points, 2)).toEqual([points[1], points[2]]);
    expect(capSparks(points, SPARK_MAX)).toEqual(points);
  });
});

describe("涟漪生命周期", () => {
  const ripple = createRipple(5, 6, 1000);
  const half = RIPPLE_DURATION_MS / 2;
  const end = RIPPLE_DURATION_MS;

  it("圆环半径 easeOutCubic 扩散：起点 0、终点最大值、中点快于线性", () => {
    expect(rippleRadiusAt(ripple, 1000)).toBe(0);
    expect(rippleRadiusAt(ripple, 1000 + half)).toBeGreaterThan(RIPPLE_MAX_RADIUS / 2);
    expect(rippleRadiusAt(ripple, 1000 + end)).toBe(RIPPLE_MAX_RADIUS);
  });

  it("透明度从峰值线性淡出到 0", () => {
    expect(rippleAlphaAt(ripple, 1000)).toBeCloseTo(RIPPLE_PEAK_ALPHA);
    expect(rippleAlphaAt(ripple, 1000 + half)).toBeCloseTo(RIPPLE_PEAK_ALPHA / 2);
    expect(rippleAlphaAt(ripple, 1000 + end)).toBe(0);
  });

  it("生命周期内存活，终点即判死；prune 只留存活项", () => {
    expect(isRippleAlive(ripple, 1000 + end - 1)).toBe(true);
    expect(isRippleAlive(ripple, 1000 + end)).toBe(false);
    expect(pruneRipples([ripple], 1000 + end)).toEqual([]);
    expect(pruneRipples([ripple], 1100)).toEqual([ripple]);
  });
});

describe("isTap", () => {
  it("位移与时长都在阈值内判定为点按", () => {
    expect(isTap(0, 0, 0, 10, 0, 300)).toBe(true);
  });

  it("位移恰好等于阈值仍算点按，超过即判拖动", () => {
    expect(isTap(0, 0, 0, TAP_MAX_DISTANCE, 0, 300)).toBe(true);
    expect(isTap(0, 0, 0, TAP_MAX_DISTANCE + 0.1, 0, 300)).toBe(false);
  });

  it("时长恰好等于阈值仍算点按，超过即判长按", () => {
    expect(isTap(0, 0, 0, 0, 0, TAP_MAX_DURATION_MS)).toBe(true);
    expect(isTap(0, 0, 0, 0, 0, TAP_MAX_DURATION_MS + 1)).toBe(false);
  });
});
