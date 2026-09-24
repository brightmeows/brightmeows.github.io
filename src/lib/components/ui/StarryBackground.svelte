<script lang="ts">
  import { onMount } from "svelte";

  import {
    BASE_STAR_COUNT,
    createMeteor,
    createStar,
    meteorTrailTail,
    updateMeteor,
    updateStar,
    type MeteorState,
    type StarState,
    type Viewport,
  } from "$lib/utils/starfield";

  const METEOR_COUNT = 8;
  /** 单帧时长上限（秒）：标签页恢复后的首帧防跳变 */
  const MAX_DT = 0.1;

  let canvasRef: HTMLCanvasElement | null = null;

  onMount(() => {
    const canvasOrNull = canvasRef;
    if (!canvasOrNull) return;
    const canvas: HTMLCanvasElement = canvasOrNull;

    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    const viewport: Viewport = { width: window.innerWidth, height: window.innerHeight };
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const stars: StarState[] = Array.from({ length: BASE_STAR_COUNT }, () => createStar(viewport));
    const meteors: MeteorState[] = Array.from({ length: METEOR_COUNT }, () =>
      createMeteor(viewport)
    );

    function drawStar(star: StarState): void {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawMeteor(meteor: MeteorState): void {
      const tail = meteorTrailTail(meteor);

      const gradient = ctx.createLinearGradient(tail.x, tail.y, meteor.x, meteor.y);

      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
      gradient.addColorStop(0.8, "rgba(255, 255, 255, 0.7)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 1)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = meteor.size * 1.5;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(meteor.x, meteor.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.beginPath();
      ctx.arc(meteor.x, meteor.y, meteor.size * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 15;
      ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    let animationId: number | null = null;
    let lastTime: number | null = null;

    function animate(now: number): void {
      const dt = lastTime === null ? 1 / 60 : Math.min((now - lastTime) / 1000, MAX_DT);
      lastTime = now;

      ctx.clearRect(0, 0, viewport.width, viewport.height);

      for (const star of stars) {
        updateStar(star, viewport, dt);
        drawStar(star);
      }

      for (const meteor of meteors) {
        updateMeteor(meteor, viewport, dt);
        drawMeteor(meteor);
      }

      animationId = requestAnimationFrame(animate);
    }

    function handleResize(): void {
      viewport.width = window.innerWidth;
      viewport.height = window.innerHeight;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
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

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
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
