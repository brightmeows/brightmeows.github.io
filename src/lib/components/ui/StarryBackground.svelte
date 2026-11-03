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
  } from "#lib/utils/ui/starfield.js";

  const METEOR_COUNT = 8;
  /** 单帧时长上限（秒）：标签页恢复后的首帧防跳变 */
  const MAX_DT = 0.1;
  /** 像素比上限：更高 dPR 只增加填充成本，视觉无损 */
  const MAX_DPR = 2;
  /** resize 防抖等待（ms）：吸收移动端地址栏伸缩的高频触发 */
  const RESIZE_DEBOUNCE_MS = 150;
  /** 星星精灵的逻辑直径基准（最大 size 为 2，直径 4） */
  const STAR_SPRITE_SIZE = 4;

  /** 深色端下星空前景（星与流星）的亮度系数：背景已压暗，前景同步变暗 */
  const DARK_SKY_DIM = 0.6;

  /** 取主题里的 Catppuccin 原始变量；CSS 变量缺失时用 fallback。 */
  function themeColor(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value === "" ? fallback : value;
  }

  /** 按主题取星点与流星颜色：星夜偏暖，深夜偏冷。 */
  function skyPalette(): { star: string; meteor: string } {
    const dark = document.documentElement.dataset.theme === "dark";
    return dark
      ? {
          star: themeColor("--ctp-sky", "#89dceb"),
          meteor: themeColor("--ctp-text", "#cdd6f4"),
        }
      : {
          star: themeColor("--ctp-rosewater", "#f4dbd6"),
          meteor: themeColor("--ctp-lavender", "#b7bdf8"),
        };
  }

  /** 把 #rrggbb 转成 canvas 可用的 rgba 字符串。 */
  function hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.replace(/^#/, "");
    const full =
      normalized.length === 3
        ? normalized
            .split("")
            .map((char) => char + char)
            .join("")
        : normalized;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /** 按当前主题取星空前景亮度系数；每帧读取，切换主题即时生效 */
  function skyDimFactor(): number {
    return document.documentElement.dataset.theme === "dark" ? DARK_SKY_DIM : 1;
  }

  interface MeteorSprite {
    state: MeteorState;
    sprite: HTMLCanvasElement;
    /** head 在精灵内的位置（物理像素） */
    anchorX: number;
    anchorY: number;
  }

  function createStarSprite(scale: number, color: string): HTMLCanvasElement {
    const sprite = document.createElement("canvas");
    sprite.width = Math.ceil(STAR_SPRITE_SIZE * scale);
    sprite.height = Math.ceil(STAR_SPRITE_SIZE * scale);
    const g = sprite.getContext("2d");
    if (!g) return sprite;
    g.fillStyle = color;
    g.beginPath();
    g.arc(
      sprite.width / 2,
      sprite.height / 2,
      (STAR_SPRITE_SIZE / 2 - 0.25) * scale,
      0,
      Math.PI * 2
    );
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    g.beginPath();
    g.arc(
      sprite.width / 2,
      sprite.height / 2,
      (STAR_SPRITE_SIZE / 2 - 0.75) * scale,
      0,
      Math.PI * 2
    );
    g.fill();
    return sprite;
  }

  function rebuildMeteorSprite(m: MeteorSprite, color: string, dpr: number): void {
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

    // head 平移到精灵内原点（CSS 像素坐标乘 dpr）；dx/dy 指向尾端，旋转后
    // 本地 -x 轴 = 尾端方向，线段沿 -x 展开即从尾到头，渐变透明端落在尾上
    g.translate(-minX * dpr, -minY * dpr);
    g.scale(dpr, dpr);
    g.rotate(Math.atan2(-dy, -dx));

    const len = Math.hypot(dx, dy);
    const gradient = g.createLinearGradient(-len, 0, 0, 0);
    gradient.addColorStop(0, hexToRgba(color, 0));
    gradient.addColorStop(0.5, hexToRgba(color, 0.3));
    gradient.addColorStop(0.8, hexToRgba(color, 0.7));
    gradient.addColorStop(1, hexToRgba(color, 1));
    g.strokeStyle = gradient;
    g.lineWidth = state.size * 1.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-len, 0);
    g.lineTo(0, 0);
    g.stroke();

    g.fillStyle = color;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = glow;
    g.shadowColor = hexToRgba(color, 0.8);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    g.beginPath();
    g.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    g.fill();

    m.sprite = sprite;
    m.anchorX = -minX * dpr;
    m.anchorY = -minY * dpr;
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

    let meteorColor = "#ffffff";

    function buildSprites(): void {
      const palette = skyPalette();
      starSprite = createStarSprite(dpr, palette.star);
      meteorColor = palette.meteor;
      meteors =
        meteors.length === 0
          ? Array.from({ length: METEOR_COUNT }, () => {
              const m: MeteorSprite = {
                state: createMeteor(viewport),
                sprite: document.createElement("canvas"),
                anchorX: 0,
                anchorY: 0,
              };
              rebuildMeteorSprite(m, meteorColor, dpr);
              return m;
            })
          : meteors.map((m) => {
              rebuildMeteorSprite(m, meteorColor, dpr);
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
      const dim = skyDimFactor();
      for (const star of stars) {
        const d = star.size * 2;
        if (d <= 0) continue;
        ctx.globalAlpha = star.opacity * dim;
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

      const dim = skyDimFactor();
      ctx.clearRect(0, 0, viewport.width, viewport.height);

      for (const star of stars) {
        updateStar(star, viewport, dt);
        const d = star.size * 2;
        if (d <= 0) continue;
        ctx.globalAlpha = star.opacity * dim;
        ctx.drawImage(starSprite, star.x - d / 2, star.y - d / 2, d, d);
      }
      ctx.globalAlpha = dim;

      for (const m of meteors) {
        if (updateMeteor(m.state, viewport, dt)) {
          rebuildMeteorSprite(m, meteorColor, dpr);
        }
        ctx.drawImage(
          m.sprite,
          m.state.x - m.anchorX / dpr,
          m.state.y - m.anchorY / dpr,
          m.sprite.width / dpr,
          m.sprite.height / dpr
        );
      }
      ctx.globalAlpha = 1;

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
      // 静态帧不会自行重绘；主题切换时重建精灵并补一帧
      const themeObserver = new MutationObserver(() => {
        buildSprites();
        drawStaticFrame();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => themeObserver.disconnect();
    }

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    // 动画分支每帧读取亮度，但精灵颜色是预渲染的，主题切换时要重建
    const themeObserver = new MutationObserver(() => buildSprites());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    animationId = requestAnimationFrame(animate);

    return () => {
      themeObserver.disconnect();
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
  class="sky-canvas pointer-events-none fixed top-0 left-0 z-0 h-full w-full"
>
</canvas>
