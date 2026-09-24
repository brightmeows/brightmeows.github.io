/**
 * 星空背景的粒子物理：纯逻辑，与渲染解耦（供 StarryBackground 使用）。
 * 速度单位为 px/s，位移按 dt（秒）缩放，帧率无关。
 */

export interface Viewport {
  width: number;
  height: number;
}

export interface StarState {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  fadeSpeed: number;
  fadeDirection: 1 | -1;
}

export interface MeteorState {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  size: number;
}

export type Rng = () => number;

/** 基准密度：1920x1080 下 200 颗星（与原桌面观感一致的密度基准） */
const BASE_STAR_VIEWPORT: Viewport = { width: 1920, height: 1080 };
export const BASE_STAR_COUNT = 200;

/** 流星出界容差（px）：超出视口该距离后重置回入场边 */
export const METEOR_MARGIN = 300;
/** 流星入场时的屏幕外偏移（px） */
const METEOR_SPAWN_OFFSET = 20;
/** 星星闪烁不透明度下限 */
const STAR_OPACITY_MIN = 0.2;

export function createStar(viewport: Viewport, rng: Rng = Math.random): StarState {
  return {
    x: rng() * viewport.width,
    y: rng() * viewport.height,
    size: rng() * 2,
    speedX: (rng() - 0.5) * 12,
    speedY: (rng() - 0.5) * 12,
    opacity: rng(),
    fadeSpeed: 0.6 + rng() * 1.2,
    fadeDirection: 1,
  };
}

export function updateStar(star: StarState, viewport: Viewport, dt: number): void {
  star.x += star.speedX * dt;
  star.y += star.speedY * dt;

  if (star.x < 0) star.x = viewport.width;
  if (star.x > viewport.width) star.x = 0;
  if (star.y < 0) star.y = viewport.height;
  if (star.y > viewport.height) star.y = 0;

  star.opacity += star.fadeSpeed * star.fadeDirection * dt;
  if (star.opacity > 1) {
    star.opacity = 1;
    star.fadeDirection = -1;
  } else if (star.opacity < STAR_OPACITY_MIN) {
    star.opacity = STAR_OPACITY_MIN;
    star.fadeDirection = 1;
  }
}

export function createMeteor(viewport: Viewport, rng: Rng = Math.random): MeteorState {
  const meteor: MeteorState = { x: 0, y: 0, speedX: 0, speedY: 0, size: 0 };
  resetMeteor(meteor, viewport, rng);
  return meteor;
}

export function resetMeteor(meteor: MeteorState, viewport: Viewport, rng: Rng = Math.random): void {
  const side = Math.floor(rng() * 4);

  if (side === 0) {
    meteor.x = rng() * viewport.width;
    meteor.y = -METEOR_SPAWN_OFFSET;
  } else if (side === 1) {
    meteor.x = rng() * viewport.width;
    meteor.y = viewport.height + METEOR_SPAWN_OFFSET;
  } else if (side === 2) {
    meteor.x = -METEOR_SPAWN_OFFSET;
    meteor.y = rng() * viewport.height;
  } else {
    meteor.x = viewport.width + METEOR_SPAWN_OFFSET;
    meteor.y = rng() * viewport.height;
  }

  // 固定朝左下（120°）：与原实现一致的入场角
  const angle = (120 * Math.PI) / 180;
  const speed = 90 + rng() * 30;
  meteor.speedX = speed * Math.cos(angle);
  meteor.speedY = speed * Math.sin(angle);
  meteor.size = 2 + rng() * 2;
}

/** 位移并检查出界；发生入场重置时返回 true */
export function updateMeteor(meteor: MeteorState, viewport: Viewport, dt: number): boolean {
  meteor.x += meteor.speedX * dt;
  meteor.y += meteor.speedY * dt;

  if (
    meteor.x < -METEOR_MARGIN ||
    meteor.x > viewport.width + METEOR_MARGIN ||
    meteor.y < -METEOR_MARGIN ||
    meteor.y > viewport.height + METEOR_MARGIN
  ) {
    resetMeteor(meteor, viewport);
    return true;
  }
  return false;
}

/** 尾迹末端坐标：默认回看 100/60 秒（原每帧 100px 偏移在 60fps 下的等效时长） */
export function meteorTrailTail(meteor: MeteorState, seconds = 100 / 60): { x: number; y: number } {
  return { x: meteor.x - meteor.speedX * seconds, y: meteor.y - meteor.speedY * seconds };
}

/** 按视口面积缩放星数，密度与基准视口一致 */
export function starCountFor(
  viewport: Viewport,
  baseCount: number = BASE_STAR_COUNT,
  baseViewport: Viewport = BASE_STAR_VIEWPORT
): number {
  return Math.max(
    0,
    Math.round(
      (baseCount * viewport.width * viewport.height) / (baseViewport.width * baseViewport.height)
    )
  );
}

export function clampDpr(dpr: number, maxDpr: number): number {
  return Math.min(dpr, maxDpr);
}

/** resize 后重分布：越界星星 wrap 进新视口，数量按新密度增删 */
export function redistributeStars(
  stars: StarState[],
  viewport: Viewport,
  rng: Rng = Math.random
): StarState[] {
  const target = starCountFor(viewport);
  const result: StarState[] = [];

  for (const star of stars) {
    if (result.length >= target) break;
    result.push({
      ...star,
      x: ((star.x % viewport.width) + viewport.width) % viewport.width,
      y: ((star.y % viewport.height) + viewport.height) % viewport.height,
    });
  }

  while (result.length < target) {
    result.push(createStar(viewport, rng));
  }
  return result;
}
