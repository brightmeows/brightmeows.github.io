<script lang="ts">
  import { onMount } from "svelte";

  import {
    capDust,
    createDust,
    dustAlphaAt,
    dustRadiusAt,
    dustSpawnCount,
    pruneDust,
    updateDust,
    type Dust,
  } from "#lib/utils/ui/trail-dust.js";

  /** 尘粒精灵的逻辑直径（px）：纯白径向渐变离屏贴图，绘制时按半径缩放 */
  const DUST_SPRITE_SIZE = 16;
  /** 单帧时长上限（秒）：标签页恢复后的首帧防跳变 */
  const MAX_DT = 0.05;
  /** 像素比上限：更高 dPR 只增加填充成本，视觉无损 */
  const MAX_DPR = 2;
  /** resize 防抖等待（ms）：吸收移动端地址栏伸缩的高频触发 */
  const RESIZE_DEBOUNCE_MS = 150;
  /** 可点元素清单：与 layout.css 的光标接线共用同一口径，改动需两处同步 */
  const HOVER_TARGET_SELECTOR = 'a, button, [role="button"], select, summary, label';

  /** 指针跟踪与尘粒序列的引擎状态 */
  interface TrailEngine {
    dust: Dust[];
    /** 撒尘间距的跨事件累计余量（px） */
    remainder: number;
    lastX: number;
    lastY: number;
    hasLast: boolean;
    lastMoveAt: number;
    /** 平滑后的指针速度（px/s），尘粒继承这份速度 */
    pointerVx: number;
    pointerVy: number;
  }

  /** 引擎初值：静止不散粒，指针速度清零。 */
  function createEngine(): TrailEngine {
    return {
      dust: [],
      remainder: 0,
      lastX: 0,
      lastY: 0,
      hasLast: false,
      lastMoveAt: 0,
      pointerVx: 0,
      pointerVy: 0,
    };
  }

  /** 构建尘粒精灵：纯白径向渐变的离屏小画布。 */
  function createDustSprite(scale: number): HTMLCanvasElement {
    const sprite = document.createElement("canvas");
    sprite.width = Math.ceil(DUST_SPRITE_SIZE * scale);
    sprite.height = Math.ceil(DUST_SPRITE_SIZE * scale);
    const g = sprite.getContext("2d");
    if (!g) return sprite;
    const grad = g.createRadialGradient(
      sprite.width / 2,
      sprite.height / 2,
      0,
      sprite.width / 2,
      sprite.height / 2,
      sprite.width / 2
    );
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.45, "rgba(255, 255, 255, 0.85)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, sprite.width, sprite.height);
    return sprite;
  }

  /**
   * 指针移动推进撒尘：沿移动线段按间距补尘，尘粒继承平滑后的指针速度。
   * 触屏拖动是浏览手势（滚动），不撒尘；pen 悬停视同鼠标。
   */
  function advanceDust(engine: TrailEngine, event: PointerEvent, now: number): void {
    if (event.pointerType === "touch") return;
    if (engine.hasLast) {
      const dtMs = Math.max(now - engine.lastMoveAt, 1);
      const dx = event.clientX - engine.lastX;
      const dy = event.clientY - engine.lastY;
      // 与上一事件的速度做混合，抑制单事件抖动
      engine.pointerVx = engine.pointerVx * 0.5 + (dx / dtMs) * 1000 * 0.5;
      engine.pointerVy = engine.pointerVy * 0.5 + (dy / dtMs) * 1000 * 0.5;
      const advance = dustSpawnCount(engine.remainder, Math.hypot(dx, dy));
      engine.remainder = advance.remainder;
      for (let i = 0; i < advance.count; i++) {
        const t = (i + 1) / advance.count;
        engine.dust.push(
          createDust(
            engine.lastX + dx * t,
            engine.lastY + dy * t,
            engine.pointerVx,
            engine.pointerVy,
            now
          )
        );
      }
    }
    engine.lastX = event.clientX;
    engine.lastY = event.clientY;
    engine.hasLast = true;
    engine.lastMoveAt = now;
  }

  // 星光光标与精灵尘拖尾画布：夹在星空与内容之间（同为 z-0，DOM 序在后），
  // 尘粒飞过玻璃面板时被 backdrop-blur 磨砂，光从玻璃下透出；不参与事件
  // 命中，不带 sky-canvas 类以免盖住真星空底色
  let canvasRef: HTMLCanvasElement | null = null;
  let haloRef: HTMLDivElement | null = null;

  /** 是否悬停在可点元素上：呼吸光环的显隐开关 */
  let haloVisible = $state(false);
  onMount(() => {
    const canvasOrNull = canvasRef;
    if (!canvasOrNull) return;
    // 粗指针（触屏）无持续悬停光标；减少动效偏好下特效全禁——两者直接不挂载
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctxOrNull = canvasOrNull.getContext("2d");
    if (!ctxOrNull) return;
    const canvas: HTMLCanvasElement = canvasOrNull;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let sprite: HTMLCanvasElement = document.createElement("canvas");

    function setupCanvas(): void {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sprite = createDustSprite(dpr);
    }

    setupCanvas();

    const engine = createEngine();

    /** 清屏重画：先按墙钟清理到期尘粒，再逐粒绘制。 */
    function render(now: number): void {
      engine.dust = capDust(pruneDust(engine.dust, now));
      ctx.clearRect(0, 0, width, height);
      for (const d of engine.dust) {
        const alpha = dustAlphaAt(d, now);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        const size = dustRadiusAt(d, now) * 2;
        ctx.drawImage(sprite, d.x - size / 2, d.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    let animationId: number | null = null;
    let lastTime: number | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    function frame(now: number): void {
      const dt = lastTime === null ? 1 / 60 : Math.min((now - lastTime) / 1000, MAX_DT);
      lastTime = now;
      for (const d of engine.dust) updateDust(d, dt);
      render(now);
      animationId = requestAnimationFrame(frame);
    }

    function handleMove(event: PointerEvent): void {
      advanceDust(engine, event, performance.now());
      if (haloRef) {
        haloRef.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      }
    }

    function handleHover(event: PointerEvent): void {
      haloVisible =
        event.target instanceof Element && event.target.closest(HOVER_TARGET_SELECTOR) !== null;
    }

    function handleLeave(): void {
      haloVisible = false;
    }

    function handleResize(): void {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setupCanvas();
      }, RESIZE_DEBOUNCE_MS);
    }

    function handleVisibility(): void {
      if (document.hidden) {
        if (animationId !== null) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      } else if (animationId === null) {
        lastTime = null;
        animationId = requestAnimationFrame(frame);
      }
    }

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerover", handleHover, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleLeave);
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    animationId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerover", handleHover);
      document.documentElement.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  });
</script>

<style>
  /* 外层管显隐过渡与定位，内层管呼吸：两层分离避免 transform 互相覆盖 */
  .cursor-halo {
    opacity: 0;
    transition: opacity 0.25s ease-out;
  }

  .cursor-halo-on {
    opacity: 1;
  }

  .cursor-halo-ring {
    position: absolute;
    top: -18px;
    left: -18px;
    width: 36px;
    height: 36px;
    border: 1.5px solid rgba(255, 255, 255, 0.9);
    border-radius: 9999px;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.25);
    animation: halo-breath 1.6s ease-in-out infinite;
  }

  @keyframes halo-breath {
    0%,
    100% {
      transform: scale(0.88);
      opacity: 0.4;
    }
    50% {
      transform: scale(1.12);
      opacity: 1;
    }
  }
</style>

<canvas bind:this={canvasRef} class="pointer-events-none fixed top-0 left-0 z-0 h-full w-full">
</canvas>

<div
  bind:this={haloRef}
  class="cursor-halo pointer-events-none fixed top-0 left-0 z-[2500] size-0"
  class:cursor-halo-on={haloVisible}
>
  <div class="cursor-halo-ring"></div>
</div>
