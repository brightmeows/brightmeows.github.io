<script lang="ts">
  import { onMount } from "svelte";

  import {
    clampDpr,
    createMeteor,
    createStar,
    meteorTrailTail,
    redistributeStars,
    starCountFor,
    updateMeteor,
    updateStar,
    type MeteorState,
    type StarState,
    type Viewport,
  } from "$lib/utils/starfield";

  const METEOR_COUNT = 8;
  /** 单帧时长上限（秒）：标签页恢复后的首帧防跳变 */
  const MAX_DT = 0.1;
  /** 像素比上限：更高 dPR 只增加填充成本，视觉无损 */
  const MAX_DPR = 2;
  /** resize 防抖等待（ms）：吸收移动端地址栏伸缩的高频触发 */
  const RESIZE_DEBOUNCE_MS = 150;
  /** 星星精灵的逻辑直径基准（最大 size 为 2，直径 4） */
  const STAR_SPRITE_SIZE = 4;

  interface MeteorSprite {
    state: MeteorState;
    sprite: HTMLCanvasElement;
    /** head 在精灵内的位置（物理像素） */
    anchorX: number;
    anchorY: number;
  }

  let canvasRef: HTMLCanvasElement | null = null;

  onMount(() => {
    const canvasOrNull = canvasRef;
    if (!canvasOrNull) return;
    const canvas: HTMLCanvasElement = canvasOrNull;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    const viewport: Viewport = { width: window.innerWidth, height: window.innerHeight };
    let dpr = 1;

    let stars: StarState[] = Array.from({ length: starCountFor(viewport) }, () =>
      createStar(viewport)
    );
    let starSprite: HTMLCanvasElement;
    let meteors: MeteorSprite[] = [];

    function createStarSprite(scale: number): HTMLCanvasElement {
      const sprite = document.createElement("canvas");
      sprite.width = Math.ceil(STAR_SPRITE_SIZE * scale);
      sprite.height = Math.ceil(STAR_SPRITE_SIZE * scale);
      const g = sprite.getContext("2d");
      if (!g) return sprite;
      g.fillStyle = "rgba(255, 255, 255, 1)";
      g.beginPath();
      g.arc(
        sprite.width / 2,
        sprite.height / 2,
        (STAR_SPRITE_SIZE / 2 - 0.25) * scale,
        0,
        Math.PI * 2
      );
      g.fill();
      return sprite;
    }

    function rebuildMeteorSprite(m: MeteorSprite): void {
      const { state } = m;
      const tail = meteorTrailTail(state);
      const dx = tail.x - state.x;
      const dy = tail.y - state.y;
      const r = state.size * 1.2;
      const half = (state.size * 1.5) / 2;
      const glow = 15;
      const pad = glow + r + half + 2;

      const minX = Math.min(0, dx) - pad;
      const maxX = Math.max(0, dx) + pad;
      const minY = Math.min(0, dy) - pad;
      const maxY = Math.max(0, dy) + pad;

      const sprite = document.createElement("canvas");
      sprite.width = Math.ceil((maxX - minX) * dpr);
      sprite.height = Math.ceil((maxY - minY) * dpr);
      const g = sprite.getContext("2d");
      if (!g) return;

      // head 平移到精灵内原点（CSS 像素坐标乘 dpr），尾迹沿 dx/dy 方向展开
      g.translate(-minX * dpr, -minY * dpr);
      g.scale(dpr, dpr);
      g.rotate(Math.atan2(dy, dx));

      const len = Math.hypot(dx, dy);
      const gradient = g.createLinearGradient(-len, 0, 0, 0);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
      gradient.addColorStop(0.8, "rgba(255, 255, 255, 0.7)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 1)");
      g.strokeStyle = gradient;
      g.lineWidth = state.size * 1.5;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-len, 0);
      g.lineTo(0, 0);
      g.stroke();

      g.fillStyle = "rgba(255, 255, 255, 1)";
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = glow;
      g.shadowColor = "rgba(255, 255, 255, 0.8)";
      g.fill();
      g.shadowBlur = 0;

      m.sprite = sprite;
      m.anchorX = -minX * dpr;
      m.anchorY = -minY * dpr;
    }

    function buildSprites(): void {
      starSprite = createStarSprite(dpr);
      meteors =
        meteors.length === 0
          ? Array.from({ length: METEOR_COUNT }, () => {
              const m: MeteorSprite = {
                state: createMeteor(viewport),
                sprite: document.createElement("canvas"),
                anchorX: 0,
                anchorY: 0,
              };
              rebuildMeteorSprite(m);
              return m;
            })
          : meteors.map((m) => {
              rebuildMeteorSprite(m);
              return m;
            });
    }

    function setupCanvas(): void {
      dpr = clampDpr(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(viewport.width * dpr);
      canvas.height = Math.round(viewport.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    setupCanvas();
    buildSprites();

    function drawStaticFrame(): void {
      for (const star of stars) {
        const d = star.size * 2;
        if (d <= 0) continue;
        ctx.globalAlpha = star.opacity;
        ctx.drawImage(starSprite, star.x - d / 2, star.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
    }

    let animationId: number | null = null;
    let lastTime: number | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    function animate(now: number): void {
      const dt = lastTime === null ? 1 / 60 : Math.min((now - lastTime) / 1000, MAX_DT);
      lastTime = now;

      ctx.clearRect(0, 0, viewport.width, viewport.height);

      for (const star of stars) {
        updateStar(star, viewport, dt);
        const d = star.size * 2;
        if (d <= 0) continue;
        ctx.globalAlpha = star.opacity;
        ctx.drawImage(starSprite, star.x - d / 2, star.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;

      for (const m of meteors) {
        if (updateMeteor(m.state, viewport, dt)) {
          rebuildMeteorSprite(m);
        }
        ctx.drawImage(
          m.sprite,
          m.state.x - m.anchorX / dpr,
          m.state.y - m.anchorY / dpr,
          m.sprite.width / dpr,
          m.sprite.height / dpr
        );
      }

      animationId = requestAnimationFrame(animate);
    }

    function handleResize(): void {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        viewport.width = window.innerWidth;
        viewport.height = window.innerHeight;
        setupCanvas();
        stars = redistributeStars(stars, viewport);
        buildSprites();
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
        animationId = requestAnimationFrame(animate);
      }
    }

    // 偏好减少动效：渲染一帧静态星空，不启动循环、不显示流星
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drawStaticFrame();
      return;
    }

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  });
</script>

<canvas
  bind:this={canvasRef}
  class="pointer-events-none fixed top-0 left-0 z-0 h-full w-full bg-[linear-gradient(180deg,#0f0c29,#302b63_50%,var(--color-background))]"
>
</canvas>
