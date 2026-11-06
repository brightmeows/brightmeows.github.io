<script lang="ts">
  import { onMount } from "svelte";

  import {
    FALLBACK_ACCENT,
    capTrailPoints,
    createRipple,
    createTrailPoint,
    isTap,
    parseHexColor,
    pruneRipples,
    pruneTrail,
    rippleAlphaAt,
    rippleRadiusAt,
    trailAlphaAt,
    trailRadiusAt,
    trailSpawnCount,
    type Ripple,
    type Rgb,
    type TrailPoint,
  } from "#lib/utils/ui/pointer-fx.js";
  import { findGlowHost } from "#lib/utils/ui/press-glow.js";
  import { clampDpr } from "#lib/utils/ui/starfield.js";

  /** 像素比上限：更高 dPR 只增加填充成本，视觉无损 */
  const MAX_DPR = 2;
  /** 拖尾光点精灵的逻辑直径（px），绘制时按半径缩放 */
  const DOT_SPRITE_SIZE = 16;
  /** 涟漪白心光斑占圆环半径的比例 */
  const RIPPLE_CORE_RATIO = 0.55;

  /** 单帧渲染所需的场景句柄：画布上下文、配色与尺寸 */
  interface FxScene {
    ctx: CanvasRenderingContext2D;
    accentBase: string;
    dotSprite: HTMLCanvasElement;
    width: number;
    height: number;
  }

  /** 指针特效引擎状态：粒子序列与指针跟踪 */
  interface FxEngine {
    trail: TrailPoint[];
    ripples: Ripple[];
    /** 撒点间距的跨事件累计余量（px） */
    remainder: number;
    lastX: number;
    lastY: number;
    hasLast: boolean;
    /** 触屏待定 tap：pointerup 时按位移与时长确认 */
    pendingTap: { x: number; y: number; at: number; skipGlow: boolean } | null;
  }

  /** 构建拖尾光点精灵：accent 径向渐变的离屏小画布。 */
  function createDotSprite(accent: Rgb, scale: number): HTMLCanvasElement {
    const sprite = document.createElement("canvas");
    sprite.width = Math.ceil(DOT_SPRITE_SIZE * scale);
    sprite.height = Math.ceil(DOT_SPRITE_SIZE * scale);
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
    const base = `${accent.r}, ${accent.g}, ${accent.b}`;
    grad.addColorStop(0, `rgba(${base}, 1)`);
    grad.addColorStop(0.45, `rgba(${base}, 0.85)`);
    grad.addColorStop(1, `rgba(${base}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, sprite.width, sprite.height);
    return sprite;
  }

  /** 绘制一枚涟漪：白心光斑加淡蓝圆环。 */
  function drawRipple(scene: FxScene, ripple: Ripple, now: number): void {
    const { ctx, accentBase } = scene;
    const alpha = rippleAlphaAt(ripple, now);
    const radius = rippleRadiusAt(ripple, now);
    const core = Math.max(radius * RIPPLE_CORE_RATIO, 1);
    const grad = ctx.createRadialGradient(ripple.x, ripple.y, 0, ripple.x, ripple.y, core);
    grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(alpha, 1).toFixed(3)})`);
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, core, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${accentBase}, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** 清屏并绘制全部拖尾光点与涟漪。 */
  function renderFx(scene: FxScene, trail: TrailPoint[], ripples: Ripple[], now: number): void {
    const { ctx } = scene;
    ctx.clearRect(0, 0, scene.width, scene.height);
    for (const point of trail) {
      ctx.globalAlpha = trailAlphaAt(point, now);
      const d = trailRadiusAt(point, now) * 2;
      ctx.drawImage(scene.dotSprite, point.x - d / 2, point.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
    for (const ripple of ripples) drawRipple(scene, ripple, now);
  }

  function createFxEngine(): FxEngine {
    return {
      trail: [],
      ripples: [],
      remainder: 0,
      lastX: 0,
      lastY: 0,
      hasLast: false,
      pendingTap: null,
    };
  }

  /** 清空粒子与指针跟踪（detach 与偏好切换时用）。 */
  function resetFxEngine(engine: FxEngine): void {
    engine.trail = [];
    engine.ripples = [];
    engine.remainder = 0;
    engine.lastX = 0;
    engine.lastY = 0;
    engine.hasLast = false;
    engine.pendingTap = null;
  }

  /** 指针移动推进拖尾；返回本次是否撒了新点。触屏拖动是浏览手势（滚动），不画拖尾。 */
  function advanceTrail(engine: FxEngine, event: PointerEvent): boolean {
    if (event.pointerType === "touch") return false;
    let spawned = false;
    if (engine.hasLast) {
      const advance = trailSpawnCount(
        engine.remainder,
        Math.hypot(event.clientX - engine.lastX, event.clientY - engine.lastY)
      );
      engine.remainder = advance.remainder;
      for (let i = 0; i < advance.count; i++) {
        const t = (i + 1) / advance.count;
        engine.trail.push(
          createTrailPoint(
            engine.lastX + (event.clientX - engine.lastX) * t,
            engine.lastY + (event.clientY - engine.lastY) * t,
            performance.now()
          )
        );
      }
      spawned = advance.count > 0;
    }
    engine.lastX = event.clientX;
    engine.lastY = event.clientY;
    engine.hasLast = true;
    return spawned;
  }

  /**
   * 指针按下：触屏登记待定 tap（等 pointerup 确认），鼠标立即决策。
   * 点在盒状控件上只出按钮光斑，返回待出涟漪的触点与是否跳过。
   */
  function beginPress(
    engine: FxEngine,
    event: PointerEvent
  ): { x: number; y: number; skip: boolean } | null {
    const skip = findGlowHost(event.target) !== null;
    if (event.pointerType === "touch") {
      engine.pendingTap = {
        x: event.clientX,
        y: event.clientY,
        at: performance.now(),
        skipGlow: skip,
      };
      return null;
    }
    return { x: event.clientX, y: event.clientY, skip };
  }

  /** 指针抬起：确认触屏 tap（位移与时长都在阈值内），返回待出涟漪的触点。 */
  function endPress(engine: FxEngine, event: PointerEvent): { x: number; y: number } | null {
    const pending = engine.pendingTap;
    engine.pendingTap = null;
    if (!pending || pending.skipGlow) return null;
    if (isTap(pending.x, pending.y, pending.at, event.clientX, event.clientY, performance.now())) {
      return { x: pending.x, y: pending.y };
    }
    return null;
  }

  /** 按墙钟清理到期粒子。 */
  function pruneFx(engine: FxEngine, now: number): void {
    engine.trail = capTrailPoints(pruneTrail(engine.trail, now));
    engine.ripples = pruneRipples(engine.ripples, now);
  }

  /** 挂载六路监听（指针四路 + resize + 页签可见性），返回解绑函数。 */
  function wireFxListeners(listeners: {
    move: (event: PointerEvent) => void;
    down: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
    cancel: () => void;
    resize: () => void;
    visibility: () => void;
  }): () => void {
    window.addEventListener("pointermove", listeners.move, { passive: true });
    window.addEventListener("pointerdown", listeners.down, { passive: true });
    window.addEventListener("pointerup", listeners.up, { passive: true });
    window.addEventListener("pointercancel", listeners.cancel, { passive: true });
    window.addEventListener("resize", listeners.resize);
    document.addEventListener("visibilitychange", listeners.visibility);
    return () => {
      window.removeEventListener("pointermove", listeners.move);
      window.removeEventListener("pointerdown", listeners.down);
      window.removeEventListener("pointerup", listeners.up);
      window.removeEventListener("pointercancel", listeners.cancel);
      window.removeEventListener("resize", listeners.resize);
      document.removeEventListener("visibilitychange", listeners.visibility);
    };
  }

  let canvasRef: HTMLCanvasElement | null = null;

  onMount(() => {
    const canvasOrNull = canvasRef;
    if (!canvasOrNull) return;
    const canvas: HTMLCanvasElement = canvasOrNull;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    const accent: Rgb =
      parseHexColor(
        getComputedStyle(document.documentElement).getPropertyValue("--color-accent")
      ) ?? FALLBACK_ACCENT;

    const scene: FxScene = {
      ctx,
      accentBase: `${accent.r}, ${accent.g}, ${accent.b}`,
      dotSprite: createDotSprite(accent, 1),
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const engine = createFxEngine();
    let detachListeners: (() => void) | null = null;
    let frameId: number | null = null;
    let attached = false;

    function setupCanvas(): void {
      const dpr = clampDpr(window.devicePixelRatio || 1, MAX_DPR);
      scene.width = window.innerWidth;
      scene.height = window.innerHeight;
      canvas.width = Math.round(scene.width * dpr);
      canvas.height = Math.round(scene.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.dotSprite = createDotSprite(accent, dpr);
    }

    function spawnRipple(x: number, y: number): void {
      engine.ripples.push(createRipple(x, y, performance.now()));
      ensureFrame();
    }

    function render(): void {
      frameId = null;
      const now = performance.now();
      pruneFx(engine, now);
      renderFx(scene, engine.trail, engine.ripples, now);
      if (engine.trail.length > 0 || engine.ripples.length > 0) {
        frameId = requestAnimationFrame(render);
      }
    }

    function ensureFrame(): void {
      if (frameId === null) frameId = requestAnimationFrame(render);
    }

    function stopFrame(): void {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    }

    function onPointerMove(event: PointerEvent): void {
      if (advanceTrail(engine, event)) ensureFrame();
    }

    function onPointerDown(event: PointerEvent): void {
      const press = beginPress(engine, event);
      if (press && !press.skip) spawnRipple(press.x, press.y);
    }

    function onPointerUp(event: PointerEvent): void {
      const ripple = endPress(engine, event);
      if (ripple) spawnRipple(ripple.x, ripple.y);
    }

    function onPointerCancel(): void {
      engine.pendingTap = null;
    }

    function handleVisibility(): void {
      // 粒子时刻按墙钟推进：隐藏时停帧即可，恢复后到期粒子直接被清理
      if (document.hidden) {
        stopFrame();
      } else if (engine.trail.length > 0 || engine.ripples.length > 0) {
        ensureFrame();
      }
    }

    function attach(): void {
      if (attached) return;
      attached = true;
      detachListeners = wireFxListeners({
        move: onPointerMove,
        down: onPointerDown,
        up: onPointerUp,
        cancel: onPointerCancel,
        resize: setupCanvas,
        visibility: handleVisibility,
      });
    }

    function detach(): void {
      if (!attached) return;
      attached = false;
      detachListeners?.();
      detachListeners = null;
      stopFrame();
      resetFxEngine(engine);
      ctx.clearRect(0, 0, scene.width, scene.height);
    }

    // 偏好减少动效：特效全禁（站点既有口径），偏好切换即时生效
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (): void => {
      if (motionMedia.matches) {
        detach();
      } else {
        setupCanvas();
        attach();
      }
    };

    setupCanvas();
    if (!motionMedia.matches) attach();
    motionMedia.addEventListener("change", handleMotionChange);

    return () => {
      motionMedia.removeEventListener("change", handleMotionChange);
      detach();
    };
  });
</script>

<!-- 指针特效画布：置顶覆盖全站，只承载叠加光效，不参与事件命中 -->
<canvas bind:this={canvasRef} class="pointer-events-none fixed top-0 left-0 z-1100 h-full w-full">
</canvas>
