import { describe, expect, it } from "vitest";

import {
  BASE_STAR_COUNT,
  METEOR_MARGIN,
  clampDpr,
  createMeteor,
  createStar,
  meteorTrailTail,
  redistributeStars,
  resetMeteor,
  starCountFor,
  updateMeteor,
  updateStar,
  type StarState,
} from "./starfield";

/** 确定性 rng：按序列循环返回预设值（循环索引由取模保证界内） */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

const viewport = { width: 1920, height: 1080 };

describe("createStar", () => {
  it("rng 全 0 时落在域下界，速度朝左上、闪烁向上", () => {
    const star = createStar(viewport, seqRng([0]));
    expect(star.x).toBe(0);
    expect(star.y).toBe(0);
    expect(star.size).toBe(0);
    expect(star.speedX).toBe(-6);
    expect(star.speedY).toBe(-6);
    expect(star.opacity).toBe(0);
    expect(star.fadeSpeed).toBeCloseTo(0.6);
    expect(star.fadeDirection).toBe(1);
  });

  it("rng 全接近 1 时位置与不透明度在 [0, 1) 域内", () => {
    const star = createStar(viewport, () => 0.999);
    expect(star.x).toBeLessThan(viewport.width);
    expect(star.y).toBeLessThan(viewport.height);
    expect(star.opacity).toBeLessThan(1);
    expect(star.fadeSpeed).toBeLessThan(1.8);
  });
});

describe("updateStar", () => {
  it("按 dt 缩放位移：6 px/s 乘 0.5s 位移 3px", () => {
    const star: StarState = {
      x: 100,
      y: 100,
      size: 1,
      speedX: 6,
      speedY: -6,
      opacity: 0.5,
      fadeSpeed: 1,
      fadeDirection: 1,
    };
    updateStar(star, viewport, 0.5);
    expect(star.x).toBe(103);
    expect(star.y).toBe(97);
  });

  it("越左界后从右界进入（wrap）", () => {
    const star: StarState = {
      x: -1,
      y: 500,
      size: 1,
      speedX: 6,
      speedY: 0,
      opacity: 0.5,
      fadeSpeed: 1,
      fadeDirection: 1,
    };
    updateStar(star, viewport, 0);
    expect(star.x).toBe(viewport.width);
  });

  it("不透明度到 1 后翻转衰减方向并夹在 1", () => {
    const star: StarState = {
      x: 100,
      y: 100,
      size: 1,
      speedX: 0,
      speedY: 0,
      opacity: 0.99,
      fadeSpeed: 1,
      fadeDirection: 1,
    };
    updateStar(star, viewport, 0.1);
    expect(star.opacity).toBe(1);
    expect(star.fadeDirection).toBe(-1);
  });

  it("不透明度低于下限后翻转增强方向并夹在下限", () => {
    const star: StarState = {
      x: 100,
      y: 100,
      size: 1,
      speedX: 0,
      speedY: 0,
      opacity: 0.21,
      fadeSpeed: 1,
      fadeDirection: -1,
    };
    updateStar(star, viewport, 0.1);
    expect(star.opacity).toBe(0.2);
    expect(star.fadeDirection).toBe(1);
  });
});

describe("resetMeteor", () => {
  it("side 0 时从顶边屏外入场，速度朝左下", () => {
    const meteor = createMeteor(viewport, seqRng([0, 0.5, 0]));
    expect(meteor.y).toBe(-20);
    expect(meteor.x).toBe(0.5 * viewport.width);
    expect(meteor.speedX).toBeLessThan(0);
    expect(meteor.speedY).toBeGreaterThan(0);
  });

  it("side 3 时从右边缘外入场（直接调用 resetMeteor）", () => {
    const meteor = createMeteor(viewport, seqRng([0, 0.5, 0]));
    resetMeteor(meteor, viewport, seqRng([0.999, 0.5, 0.5]));
    expect(meteor.x).toBe(viewport.width + 20);
    expect(meteor.y).toBe(0.5 * viewport.height);
  });

  it("速度大小在 90~120 px/s 域内", () => {
    const meteor = createMeteor(viewport, () => 0.5);
    const speed = Math.hypot(meteor.speedX, meteor.speedY);
    expect(speed).toBeGreaterThanOrEqual(90);
    expect(speed).toBeLessThanOrEqual(120);
  });
});

describe("updateMeteor", () => {
  it("出界超过容差后重置回入场域", () => {
    const meteor = createMeteor(viewport, () => 0.5);
    meteor.x = -METEOR_MARGIN - 1;
    meteor.y = 500;
    updateMeteor(meteor, viewport, 0);
    expect(meteor.x).toBeGreaterThanOrEqual(-20);
    expect(meteor.x).toBeLessThanOrEqual(viewport.width + 20);
  });

  it("界内容差内不重置", () => {
    const meteor = createMeteor(viewport, () => 0.5);
    meteor.x = -METEOR_MARGIN;
    meteor.y = 500;
    const speedX = meteor.speedX;
    updateMeteor(meteor, viewport, 0);
    expect(meteor.speedX).toBe(speedX);
  });
});

describe("meteorTrailTail", () => {
  it("尾端 = 当前位置减去速度乘时长", () => {
    const meteor = createMeteor(viewport, () => 0.5);
    const tail = meteorTrailTail(meteor);
    expect(tail.x).toBeCloseTo(meteor.x - meteor.speedX * (100 / 60));
    expect(tail.y).toBeCloseTo(meteor.y - meteor.speedY * (100 / 60));
  });
});

describe("starCountFor", () => {
  it("基准视口返回基准星数", () => {
    expect(starCountFor(viewport)).toBe(BASE_STAR_COUNT);
    expect(BASE_STAR_COUNT).toBe(200);
  });

  it("按面积等比缩放：390x844 约为基准的三成", () => {
    expect(starCountFor({ width: 390, height: 844 })).toBe(32);
  });

  it("零面积返回 0", () => {
    expect(starCountFor({ width: 0, height: 1080 })).toBe(0);
  });
});

describe("clampDpr", () => {
  it("超出上限取上限", () => {
    expect(clampDpr(3, 2)).toBe(2);
  });

  it("低于上限原样返回", () => {
    expect(clampDpr(1.5, 2)).toBe(1.5);
  });
});

describe("redistributeStars", () => {
  it("数量按新密度截断，越界坐标 wrap 进新视口", () => {
    const stars = Array.from({ length: 10 }, () => createStar(viewport));
    const small = { width: 1000, height: 500 };
    const redistributed = redistributeStars(stars, small);
    expect(redistributed.length).toBe(starCountFor(small));
    for (const star of redistributed) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(small.width);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(small.height);
    }
  });

  it("负坐标 wrap 为正域内值", () => {
    const star = createStar(viewport);
    star.x = -10;
    star.y = -10;
    const redistributed = redistributeStars([star], viewport);
    expect(redistributed[0]!.x).toBe(viewport.width - 10);
    expect(redistributed[0]!.y).toBe(viewport.height - 10);
  });

  it("数量不足时补新星到目标密度", () => {
    const redistributed = redistributeStars([], viewport, seqRng([0.25]));
    expect(redistributed.length).toBe(BASE_STAR_COUNT);
    expect(redistributed[0]!.x).toBeCloseTo(0.25 * viewport.width);
  });
});
