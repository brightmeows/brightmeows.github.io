/**
 * 全局指针特效（点按涟漪与纯白精灵尘拖尾）的纯逻辑：生命周期、缓动
 * 曲线、闪烁与漂移物理，与渲染解耦（供 PointerFxCanvas 使用）。所有
 * 时刻均为 performance.now 毫秒，坐标与半径单位为 CSS 像素，速度单位
 * 为 px/s。
 */

export interface Spark {
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

export interface Ripple {
  x: number;
  y: number;
  /** 出生时刻（毫秒） */
  born: number;
}

/** 精灵尘撒点间距（px）：指针每累计移动该距离补一颗微粒 */
export const SPARK_SPAWN_DISTANCE = 12;
/** 精灵尘基准寿命（ms），逐粒带随机抖动 */
export const SPARK_LIFE_MS = 1000;
/** 精灵尘峰值透明度（乘闪烁包络后为实际上限） */
export const SPARK_PEAK_ALPHA = 0.85;
/** 精灵尘基准出生半径（px） */
export const SPARK_RADIUS = 3.2;
/** 精灵尘数量上限：异常高频移动下的画布循环护栏 */
export const SPARK_MAX = 140;
/** 随机漂移幅度（px/s）：单轴取值范围为正负该值 */
export const SPARK_DRIFT = 22;
/** 指针速度继承比例：撒出的微粒带走指针速度的这一份额 */
export const SPARK_INHERIT = 0.18;
/** 漂移速度的指数衰减系数（每秒） */
export const SPARK_DAMPING = 1.8;
/** 光标亮核半径（px） */
export const HEAD_RADIUS = 5.5;
/** 光标亮核峰值透明度 */
export const HEAD_ALPHA = 0.85;
/** 光标亮核停止移动后的存留时长（ms），期内渐熄 */
export const HEAD_FADE_MS = 180;
/** 点击迸溅微粒数 */
export const SPLASH_COUNT = 7;
/** 迸溅初速下限与上限（px/s） */
export const SPLASH_SPEED_MIN = 40;
export const SPLASH_SPEED_MAX = 110;
/** 迸溅微粒基准寿命（ms） */
export const SPLASH_LIFE_MS = 700;

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

/** 生成精灵尘微粒：继承指针速度的一小份，叠加随机漂移与散布。 */
export function createSpark(
  x: number,
  y: number,
  pointerVx: number,
  pointerVy: number,
  born: number,
  rng: () => number = Math.random
): Spark {
  return {
    x: x + (rng() - 0.5) * 4,
    y: y + (rng() - 0.5) * 4,
    vx: pointerVx * SPARK_INHERIT + (rng() - 0.5) * 2 * SPARK_DRIFT,
    vy: pointerVy * SPARK_INHERIT + (rng() - 0.5) * 2 * SPARK_DRIFT,
    born,
    life: SPARK_LIFE_MS * (0.75 + rng() * 0.5),
    size: SPARK_RADIUS * (0.7 + rng() * 0.6),
    phase: rng() * Math.PI * 2,
    frequency: 2 + rng() * 3,
  };
}

/** 生成点击迸溅微粒：从触点向四周均匀射出，速度在上下限间随机。 */
export function createSplash(
  x: number,
  y: number,
  born: number,
  rng: () => number = Math.random
): Spark[] {
  const sparks: Spark[] = [];
  for (let i = 0; i < SPLASH_COUNT; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = SPLASH_SPEED_MIN + rng() * (SPLASH_SPEED_MAX - SPLASH_SPEED_MIN);
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      born,
      life: SPLASH_LIFE_MS * (0.8 + rng() * 0.4),
      size: 1.6 + rng() * 1.2,
      phase: rng() * Math.PI * 2,
      frequency: 2 + rng() * 3,
    });
  }
  return sparks;
}

/** 撒点累加器推进：距离累计到撒点间距即计数，返回更新后的余量与应撒点数。 */
export function sparkSpawnCount(
  remainder: number,
  distance: number
): { remainder: number; count: number } {
  let acc = remainder + distance;
  let count = 0;
  while (acc >= SPARK_SPAWN_DISTANCE) {
    acc -= SPARK_SPAWN_DISTANCE;
    count += 1;
  }
  return { remainder: acc, count };
}

/** 推进一帧：位置按速度积分，速度按指数衰减（帧率无关）。 */
export function updateSpark(spark: Spark, dt: number): void {
  spark.x += spark.vx * dt;
  spark.y += spark.vy * dt;
  const damping = Math.exp(-SPARK_DAMPING * dt);
  spark.vx *= damping;
  spark.vy *= damping;
}

/** 微粒年龄进度：0 起步，1 为寿命终点（越界后继续增长）。 */
export function sparkProgress(spark: Spark, now: number): number {
  return (now - spark.born) / spark.life;
}

/** 微粒是否存活。 */
export function isSparkAlive(spark: Spark, now: number): boolean {
  return now - spark.born < spark.life;
}

/** 微粒当前透明度：衰减包络乘独立闪烁项（各粒相位与频率不同）。 */
export function sparkAlphaAt(spark: Spark, now: number): number {
  const t = Math.min(Math.max(sparkProgress(spark, now), 0), 1);
  const envelope = (1 - t) ** 1.3;
  const twinkle = 0.55 + 0.45 * Math.sin(2 * Math.PI * spark.frequency * t + spark.phase);
  return SPARK_PEAK_ALPHA * envelope * twinkle;
}

/** 微粒当前半径：随寿命收缩到六成半。 */
export function sparkRadiusAt(spark: Spark, now: number): number {
  const t = Math.min(Math.max(sparkProgress(spark, now), 0), 1);
  return spark.size * (1 - 0.35 * t);
}

/** 清理到期微粒，返回存活序列。 */
export function pruneSparks(sparks: Spark[], now: number): Spark[] {
  return sparks.filter((spark) => isSparkAlive(spark, now));
}

/** 数量封顶：超出上限时丢弃最旧的微粒。 */
export function capSparks(sparks: Spark[], max: number = SPARK_MAX): Spark[] {
  return sparks.length > max ? sparks.slice(sparks.length - max) : sparks;
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
