import { describe, expect, it } from "vitest";

import {
  RIPPLE_DURATION_MS,
  RIPPLE_MAX_RADIUS,
  RIPPLE_PEAK_ALPHA,
  TAP_MAX_DISTANCE,
  TAP_MAX_DURATION_MS,
  TRAIL_LIFE_MS,
  TRAIL_PEAK_ALPHA,
  TRAIL_RADIUS,
  TRAIL_SPAWN_DISTANCE,
  capTrailPoints,
  createRipple,
  createTrailPoint,
  isRippleAlive,
  isTap,
  isTrailAlive,
  parseHexColor,
  pruneRipples,
  pruneTrail,
  rippleAlphaAt,
  rippleRadiusAt,
  trailAlphaAt,
  trailProgress,
  trailRadiusAt,
  trailSpawnCount,
} from "./pointer-fx";

/** 确定性 rng：按序列循环返回预设值（循环索引由取模保证界内） */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("createTrailPoint", () => {
  it("rng 全 0 时落在抖动下界：位置偏移 -1.5、寿命 0.8 倍、半径 0.8 倍", () => {
    const point = createTrailPoint(10, 20, 1000, seqRng([0]));
    expect(point.x).toBe(10 - 1.5);
    expect(point.y).toBe(20 - 1.5);
    expect(point.born).toBe(1000);
    expect(point.life).toBeCloseTo(TRAIL_LIFE_MS * 0.8);
    expect(point.size).toBeCloseTo(TRAIL_RADIUS * 0.8);
  });

  it("rng 全 1 时落在抖动上界：位置偏移 +1.5、寿命 1.2 倍、半径 1.2 倍", () => {
    const point = createTrailPoint(10, 20, 1000, seqRng([1]));
    expect(point.x).toBe(10 + 1.5);
    expect(point.y).toBe(20 + 1.5);
    expect(point.life).toBeCloseTo(TRAIL_LIFE_MS * 1.2);
    expect(point.size).toBeCloseTo(TRAIL_RADIUS * 1.2);
  });
});

describe("trailSpawnCount", () => {
  it("不足撒点间距时只累计余量，不撒点", () => {
    expect(trailSpawnCount(0, TRAIL_SPAWN_DISTANCE - 0.1)).toEqual({
      remainder: TRAIL_SPAWN_DISTANCE - 0.1,
      count: 0,
    });
  });

  it("恰好达到间距时撒一颗并清空余量", () => {
    expect(trailSpawnCount(0, TRAIL_SPAWN_DISTANCE)).toEqual({ remainder: 0, count: 1 });
  });

  it("单次长距离按间距拆成多颗，余量保留", () => {
    expect(trailSpawnCount(0, TRAIL_SPAWN_DISTANCE * 2 + 4)).toEqual({ remainder: 4, count: 2 });
  });

  it("余量跨事件累计：余差 1 再走 2 即撒一颗", () => {
    expect(trailSpawnCount(TRAIL_SPAWN_DISTANCE - 1, 2)).toEqual({ remainder: 1, count: 1 });
  });
});

describe("trailProgress / isTrailAlive", () => {
  const point = { x: 0, y: 0, born: 1000, life: TRAIL_LIFE_MS, size: 2 };

  it("出生时进度为 0，寿命终点为 1，越界后继续增长", () => {
    expect(trailProgress(point, 1000)).toBe(0);
    expect(trailProgress(point, 1000 + TRAIL_LIFE_MS)).toBe(1);
    expect(trailProgress(point, 1000 + TRAIL_LIFE_MS * 1.2)).toBe(1.2);
  });

  it("寿命内存活，终点即判死", () => {
    expect(isTrailAlive(point, 1000 + TRAIL_LIFE_MS - 1)).toBe(true);
    expect(isTrailAlive(point, 1000 + TRAIL_LIFE_MS)).toBe(false);
  });
});

describe("trailAlphaAt / trailRadiusAt", () => {
  const point = { x: 0, y: 0, born: 1000, life: TRAIL_LIFE_MS, size: TRAIL_RADIUS };

  it("出生时取峰值透明度，寿命终点归零", () => {
    expect(trailAlphaAt(point, 1000)).toBeCloseTo(TRAIL_PEAK_ALPHA);
    expect(trailAlphaAt(point, 1000 + TRAIL_LIFE_MS)).toBe(0);
  });

  it("透明度单调衰减且中途低于线性中点（先快后慢）", () => {
    const mid = trailAlphaAt(point, 1000 + TRAIL_LIFE_MS / 2);
    expect(mid).toBeLessThan(TRAIL_PEAK_ALPHA / 2);
    expect(trailAlphaAt(point, 1300)).toBeLessThan(trailAlphaAt(point, 1200));
  });

  it("半径随寿命收缩到四成", () => {
    expect(trailRadiusAt(point, 1000)).toBeCloseTo(TRAIL_RADIUS);
    expect(trailRadiusAt(point, 1000 + TRAIL_LIFE_MS)).toBeCloseTo(TRAIL_RADIUS * 0.6);
  });
});

describe("pruneTrail / capTrailPoints", () => {
  it("只保留寿命内的光点", () => {
    const alive = { x: 0, y: 0, born: 900, life: 500, size: 2 };
    const dead = { x: 0, y: 0, born: 100, life: 500, size: 2 };
    expect(pruneTrail([alive, dead], 1000)).toEqual([alive]);
  });

  it("超上限时丢弃最旧的，未超上限原样返回", () => {
    const points = [
      { x: 0, y: 0, born: 0, life: 500, size: 2 },
      { x: 1, y: 0, born: 1, life: 500, size: 2 },
      { x: 2, y: 0, born: 2, life: 500, size: 2 },
    ];
    expect(capTrailPoints(points, 2)).toEqual([points[1], points[2]]);
    expect(capTrailPoints(points, 5)).toEqual(points);
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
    expect(pruneRipples([ripple], 1000 + 100)).toEqual([ripple]);
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

describe("parseHexColor", () => {
  it("解析六位十六进制（含 # 与大小写、首尾空白）", () => {
    expect(parseHexColor("#64b5f6")).toEqual({ r: 100, g: 181, b: 246 });
    expect(parseHexColor(" #64B5F6 ")).toEqual({ r: 100, g: 181, b: 246 });
    expect(parseHexColor("64b5f6")).toEqual({ r: 100, g: 181, b: 246 });
  });

  it("解析三位简写并展开", () => {
    expect(parseHexColor("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("非法格式返回 null", () => {
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("#64b5f")).toBeNull();
    expect(parseHexColor("#64b5f6x")).toBeNull();
    expect(parseHexColor("rgb(1,2,3)")).toBeNull();
  });
});
