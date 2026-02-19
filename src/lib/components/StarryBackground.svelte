<script lang="ts">
  import { onMount } from "svelte";

  class Star {
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
    fadeSpeed: number;
    fadeDirection: number;

    constructor(width: number, height: number) {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.size = Math.random() * 2;
      this.speedX = (Math.random() - 0.5) * 0.2;
      this.speedY = (Math.random() - 0.5) * 0.2;
      this.opacity = Math.random();
      this.fadeSpeed = 0.01 + Math.random() * 0.02;
      this.fadeDirection = 1;
    }

    update(width: number, height: number): void {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;

      this.opacity += this.fadeSpeed * this.fadeDirection;
      if (this.opacity > 1) {
        this.opacity = 1;
        this.fadeDirection = -1;
      } else if (this.opacity < 0.2) {
        this.opacity = 0.2;
        this.fadeDirection = 1;
      }
    }

    draw(ctx: CanvasRenderingContext2D): void {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class Meteor {
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    speedX: number;
    speedY: number;
    size: number;
    trailLength: number;
    active: boolean;

    constructor(width: number, height: number) {
      this.x = 0;
      this.y = 0;
      this.prevX = 0;
      this.prevY = 0;
      this.speedX = 0;
      this.speedY = 0;
      this.size = 0;
      this.trailLength = 0;
      this.active = true;
      this.init(width, height);
    }

    init(width: number, height: number): void {
      const side = Math.floor(Math.random() * 4);

      if (side === 0) {
        this.x = Math.random() * width;
        this.y = -20;
      } else if (side === 1) {
        this.x = Math.random() * width;
        this.y = height + 20;
      } else if (side === 2) {
        this.x = -20;
        this.y = Math.random() * height;
      } else {
        this.x = width + 20;
        this.y = Math.random() * height;
      }

      this.prevX = this.x;
      this.prevY = this.y;

      const angle = (90 + 30) * (Math.PI / 180);
      const speed = 1.5 + Math.random() * 0.5;

      this.speedX = speed * Math.cos(angle);
      this.speedY = speed * Math.sin(angle);

      this.size = 2 + Math.random() * 2;
      this.trailLength = 150 + Math.random() * 100;
    }

    update(width: number, height: number): void {
      this.prevX = this.x;
      this.prevY = this.y;

      this.x += this.speedX;
      this.y += this.speedY;

      if (this.x < -300 || this.x > width + 300 || this.y < -300 || this.y > height + 300) {
        this.init(width, height);
      }
    }

    draw(ctx: CanvasRenderingContext2D): void {
      const trailX = this.x - this.speedX * 100;
      const trailY = this.y - this.speedY * 100;

      const gradient = ctx.createLinearGradient(trailX, trailY, this.x, this.y);

      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
      gradient.addColorStop(0.8, "rgba(255, 255, 255, 0.7)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 1)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = this.size * 1.5;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 15;
      ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  let canvasRef: HTMLCanvasElement | null = null;

  onMount(() => {
    const canvas = canvasRef;
    if (!canvas) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    const stars: Star[] = [];
    const STAR_COUNT = 200;

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push(new Star(width, height));
    }

    const meteors: Meteor[] = [];
    const METEOR_COUNT = 8;

    for (let i = 0; i < METEOR_COUNT; i++) {
      meteors.push(new Meteor(width, height));
    }

    let animationId: number | null = null;

    function animate(): void {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#0f0c29");
      gradient.addColorStop(0.5, "#302b63");
      gradient.addColorStop(1, "#24243e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      stars.forEach((star) => {
        star.update(width, height);
        star.draw(ctx);
      });

      meteors.forEach((meteor) => {
        meteor.update(width, height);
        meteor.draw(ctx);
      });

      animationId = requestAnimationFrame(animate);
    }

    const handleResize = (): void => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  });
</script>

<canvas bind:this={canvasRef} class="pointer-events-none fixed top-0 left-0 z-0 h-full w-full">
</canvas>
