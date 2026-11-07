/**
 * 全局指针特效（点按涟漪与彗尾光点拖尾）的纯逻辑：生命周期、缓动曲线
 * 与撒点节奏，与渲染解耦（供 PointerFxCanvas 使用）。所有时刻均为
 * performance.now 毫秒，坐标与半径单位为 CSS 像素。
 */

export interface TrailPoint {
  x: number;
  y: number;
  /** 出生时刻（毫秒） */
  born: number;
  /** 寿命（毫秒），到期后移除 */
  life: number;
  /** 出生半径（px），随寿命收缩 */
  size: number;
}

export interface Ripple {
  x: number;
  y: number;
  /** 出生时刻（毫秒） */
  born: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 拖尾撒点间距（px）：指针每累计移动该距离补一颗光点 */
export const TRAIL_SPAWN_DISTANCE = 12;
/** 拖尾光点基准寿命（ms），逐点带随机抖动 */
export const TRAIL_LIFE_MS = 900;
/** 拖尾光点峰值透明度 */
export const TRAIL_PEAK_ALPHA = 0.75;
/** 拖尾光点基准出生半径（px） */
export const TRAIL_RADIUS = 4.5;
/** 拖尾光点数量上限：异常高频移动下的画布循环护栏 */
export const TRAIL_MAX_POINTS = 120;

/** 涟漪生命周期（ms） */
export const RIPPLE_DURATION_MS = 450;
/** 涟漪圆环最大半径（px） */
export const RIPPLE_MAX_RADIUS = 48;
/** 涟漪峰值透明度（圆环与白心光斑共用基准） */
export const RIPPLE_PEAK_ALPHA = 0.55;

/** 触屏点按判定的最大位移（px）：超过视为拖动滚动，不产生涟漪 */
export const TAP_MAX_DISTANCE = 12;
/** 触屏点按判定的最大时长（ms） */
export const TAP_MAX_DURATION_MS = 350;

/** 兜底强调色：--color-accent 读取失败时按 #64b5f6 处理 */
export const FALLBACK_ACCENT: Rgb = { r: 100, g: 181, b: 246 };

/** 生成拖尾光点：寿命与尺寸带随机抖动，位置带微小散布让尾迹更自然。 */
export function createTrailPoint(
  x: number,
  y: number,
  born: number,
  rng: () => number = Math.random
): TrailPoint {
  return {
    x: x + (rng() - 0.5) * 3,
    y: y + (rng() - 0.5) * 3,
    born,
    life: TRAIL_LIFE_MS * (0.8 + rng() * 0.4),
    size: TRAIL_RADIUS * (0.8 + rng() * 0.4),
  };
}

/** 撒点累加器推进：距离累计到撒点间距即计数，返回更新后的余量与应撒点数。 */
export function trailSpawnCount(
  remainder: number,
  distance: number
): { remainder: number; count: number } {
  let acc = remainder + distance;
  let count = 0;
  while (acc >= TRAIL_SPAWN_DISTANCE) {
    acc -= TRAIL_SPAWN_DISTANCE;
    count += 1;
  }
  return { remainder: acc, count };
}

/** 光点年龄进度：0 起步，1 为寿命终点（越界后继续增长）。 */
export function trailProgress(point: TrailPoint, now: number): number {
  return (now - point.born) / point.life;
}

/** 光点是否存活。 */
export function isTrailAlive(point: TrailPoint, now: number): boolean {
  return now - point.born < point.life;
}

/** 光点当前透明度：峰值快速衰减后缓收尾。 */
export function trailAlphaAt(point: TrailPoint, now: number): number {
  const t = Math.min(Math.max(trailProgress(point, now), 0), 1);
  return TRAIL_PEAK_ALPHA * (1 - t) ** 1.5;
}

/** 光点当前半径：随寿命收缩到六成。 */
export function trailRadiusAt(point: TrailPoint, now: number): number {
  const t = Math.min(Math.max(trailProgress(point, now), 0), 1);
  return point.size * (1 - 0.4 * t);
}

/** 清理到期光点，返回存活序列。 */
export function pruneTrail(points: TrailPoint[], now: number): TrailPoint[] {
  return points.filter((point) => isTrailAlive(point, now));
}

/** 数量封顶：超出上限时丢弃最旧的光点。 */
export function capTrailPoints(points: TrailPoint[], max: number = TRAIL_MAX_POINTS): TrailPoint[] {
  return points.length > max ? points.slice(points.length - max) : points;
}

/** 生成涟漪：出生即从触点开始扩散。 */
export function createRipple(x: number, y: number, born: number): Ripple {
  return { x, y, born };
}

/** 涟漪年龄进度：0 起步，1 为生命周期终点。 */
export function rippleProgress(ripple: Ripple, now: number): number {
  return (now - ripple.born) / RIPPLE_DURATION_MS;
}

/** 涟漪是否存活。 */
export function isRippleAlive(ripple: Ripple, now: number): boolean {
  return now - ripple.born < RIPPLE_DURATION_MS;
}

/** 涟漪圆环当前半径：easeOutCubic 扩散。 */
export function rippleRadiusAt(ripple: Ripple, now: number): number {
  const t = Math.min(Math.max(rippleProgress(ripple, now), 0), 1);
  return RIPPLE_MAX_RADIUS * (1 - (1 - t) ** 3);
}

/** 涟漪当前透明度：随进度线性淡出。 */
export function rippleAlphaAt(ripple: Ripple, now: number): number {
  const t = Math.min(Math.max(rippleProgress(ripple, now), 0), 1);
  return RIPPLE_PEAK_ALPHA * (1 - t);
}

/** 清理到期涟漪，返回存活序列。 */
export function pruneRipples(ripples: Ripple[], now: number): Ripple[] {
  return ripples.filter((ripple) => isRippleAlive(ripple, now));
}

/** 点按判定：位移与时长都在阈值内才算 tap（触屏拖动滚动不出涟漪）。 */
export function isTap(
  startX: number,
  startY: number,
  startAt: number,
  endX: number,
  endY: number,
  endAt: number
): boolean {
  const moved = Math.hypot(endX - startX, endY - startY);
  return moved <= TAP_MAX_DISTANCE && endAt - startAt <= TAP_MAX_DURATION_MS;
}

/** 解析 #rgb 与 #rrggbb 颜色为 rgb 分量，# 可省略；格式非法返回 null。 */
export function parseHexColor(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, "");
  const candidate =
    value.length === 3
      ? value
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : value;
  if (!/^[0-9a-f]{6}$/i.test(candidate)) return null;
  return {
    r: Number.parseInt(candidate.slice(0, 2), 16),
    g: Number.parseInt(candidate.slice(2, 4), 16),
    b: Number.parseInt(candidate.slice(4, 6), 16),
  };
}
