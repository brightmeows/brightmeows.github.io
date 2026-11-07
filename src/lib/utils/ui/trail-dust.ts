/**
 * 精灵尘拖尾的纯逻辑：生命周期、缓动曲线、闪烁与漂移物理，与渲染解耦
 * （供 DustTrailCanvas 使用）。所有时刻均为 performance.now 毫秒，坐标与
 * 半径单位为 CSS 像素，速度单位为 px/s。
 *
 * 形态与克制度沿用 2026-11-06/07 设计树共识：纯白不读主题色，淡而有存在
 * 感（峰值透明度约 0.4、中等密度、生命约 0.7s），静止不散粒，移动越快
 * 甩尘越长。
 */

/** 单粒精灵尘。 */
export interface Dust {
  x: number;
  y: number;
  /** 漂移速度（px/s），随时间指数衰减 */
  vx: number;
  vy: number;
  /** 出生时刻（毫秒） */
  born: number;
  /** 寿命（毫秒），到期后移除 */
  life: number;
  /** 出生半径（px），随寿命收缩 */
  size: number;
  /** 闪烁相位（弧度） */
  phase: number;
  /** 闪烁频率：寿命内的完整明灭次数（含小数） */
  frequency: number;
}

/** 撒尘间距（px）：指针每累计移动该距离补一粒尘 */
export const DUST_SPAWN_DISTANCE = 11;
/** 尘粒基准寿命（ms），逐粒带随机抖动 */
export const DUST_LIFE_MS = 700;
/** 尘粒峰值透明度（乘闪烁包络后为实际上限）：淡而有存在感档 */
export const DUST_PEAK_ALPHA = 0.4;
/** 尘粒基准出生半径（px） */
export const DUST_RADIUS = 3.2;
/** 尘粒数量上限：异常高频移动下的画布循环护栏 */
export const DUST_MAX = 90;
/** 随机漂移幅度（px/s）：单轴取值范围为正负该值 */
export const DUST_DRIFT = 22;
/** 指针速度继承比例：撒出的尘粒带走指针速度的这一份额 */
export const DUST_INHERIT = 0.18;
/** 漂移速度的指数衰减系数（每秒） */
export const DUST_DAMPING = 1.8;

/** 生成尘粒：继承指针速度的一小份，叠加随机漂移与散布。 */
export function createDust(
  x: number,
  y: number,
  pointerVx: number,
  pointerVy: number,
  born: number,
  rng: () => number = Math.random
): Dust {
  return {
    x: x + (rng() - 0.5) * 4,
    y: y + (rng() - 0.5) * 4,
    vx: pointerVx * DUST_INHERIT + (rng() - 0.5) * 2 * DUST_DRIFT,
    vy: pointerVy * DUST_INHERIT + (rng() - 0.5) * 2 * DUST_DRIFT,
    born,
    life: DUST_LIFE_MS * (0.75 + rng() * 0.5),
    size: DUST_RADIUS * (0.7 + rng() * 0.6),
    phase: rng() * Math.PI * 2,
    frequency: 2 + rng() * 3,
  };
}

/** 撒尘累加器推进：距离累计到撒尘间距即计数，返回更新后的余量与应撒粒数。 */
export function dustSpawnCount(
  remainder: number,
  distance: number
): { remainder: number; count: number } {
  let acc = remainder + distance;
  let count = 0;
  while (acc >= DUST_SPAWN_DISTANCE) {
    acc -= DUST_SPAWN_DISTANCE;
    count += 1;
  }
  return { remainder: acc, count };
}

/** 推进一帧：位置按速度积分，速度按指数衰减（帧率无关）。 */
export function updateDust(dust: Dust, dt: number): void {
  dust.x += dust.vx * dt;
  dust.y += dust.vy * dt;
  const damping = Math.exp(-DUST_DAMPING * dt);
  dust.vx *= damping;
  dust.vy *= damping;
}

/** 尘粒年龄进度：0 起步，1 为寿命终点（越界后继续增长）。 */
export function dustProgress(dust: Dust, now: number): number {
  return (now - dust.born) / dust.life;
}

/** 尘粒是否存活。 */
export function isDustAlive(dust: Dust, now: number): boolean {
  return now - dust.born < dust.life;
}

/** 尘粒当前透明度：衰减包络乘独立闪烁项（各粒相位与频率不同）。 */
export function dustAlphaAt(dust: Dust, now: number): number {
  const t = Math.min(Math.max(dustProgress(dust, now), 0), 1);
  const envelope = (1 - t) ** 1.3;
  const twinkle = 0.55 + 0.45 * Math.sin(2 * Math.PI * dust.frequency * t + dust.phase);
  return DUST_PEAK_ALPHA * envelope * twinkle;
}

/** 尘粒当前半径：随寿命收缩到六成半。 */
export function dustRadiusAt(dust: Dust, now: number): number {
  const t = Math.min(Math.max(dustProgress(dust, now), 0), 1);
  return dust.size * (1 - 0.35 * t);
}

/** 清理到期尘粒，返回存活序列。 */
export function pruneDust(dust: Dust[], now: number): Dust[] {
  return dust.filter((d) => isDustAlive(d, now));
}

/** 数量封顶：超出上限时丢弃最旧的尘粒。 */
export function capDust(dust: Dust[], max: number = DUST_MAX): Dust[] {
  return dust.length > max ? dust.slice(dust.length - max) : dust;
}

/** 悬停伴影呼吸周期（ms）：缓慢散光的完整明暗节奏 */
export const GLOW_PERIOD_MS = 1600;
/** 悬停伴影基准半径（px） */
export const GLOW_RADIUS = 14;
/** 伴影半径呼吸摆幅：半径绕基准值按此比例正弦缩放 */
export const GLOW_RADIUS_SWING = 0.14;
/** 悬停伴影峰值透明度：呼吸上界 */
export const GLOW_ALPHA_PEAK = 0.18;
/** 悬停伴影透明度低界比例：透明度在峰值的该比例与峰值之间摆动 */
export const GLOW_ALPHA_LOW = 0.72;

/** 悬停伴影当前半径：绕基准半径按呼吸周期缓慢缩放（缓慢大小变化）。 */
export function glowRadius(now: number): number {
  return GLOW_RADIUS * (1 + GLOW_RADIUS_SWING * Math.sin((2 * Math.PI * now) / GLOW_PERIOD_MS));
}

/** 悬停伴影当前透明度：与半径同相缓慢呼吸（散光明暗）。 */
export function glowAlpha(now: number): number {
  const breath = Math.sin((2 * Math.PI * now) / GLOW_PERIOD_MS);
  return GLOW_ALPHA_PEAK * (GLOW_ALPHA_LOW + (1 - GLOW_ALPHA_LOW) * ((breath + 1) / 2));
}
