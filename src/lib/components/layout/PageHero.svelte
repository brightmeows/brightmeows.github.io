<script lang="ts">
  import type { Snippet } from "svelte";

  import { topbarVisibility } from "#lib/data/store/topbar-visibility.svelte.js";

  interface Props {
    /** 页面标题；内容由调用方渲染，组件负责 h1 与布局 */
    title: Snippet;
    /** 标题下的宣传内容（说明、入口按钮等）；不传则只有标题 */
    promo?: Snippet | undefined;
    /** 标题对齐；文章页用 start，其余默认 center */
    align?: "center" | "start";
    /** 完整标题文本，供两行截断后的 title 属性使用 */
    titleText?: string | undefined;
    /** 是否把标题限制为两行；编辑态标题输入框传 false */
    clamp?: boolean;
    /** 标题锚点 id（保留旧书签落点） */
    id?: string | undefined;
  }

  let { title, promo, align = "center", titleText, clamp = true, id }: Props = $props();

  let innerEl = $state<HTMLDivElement | undefined>(undefined);
  let titleEl = $state<HTMLHeadingElement | undefined>(undefined);
  let promoContentEl = $state<HTMLDivElement | undefined>(undefined);
  let ready = $state(false);

  // 顶栏可见时停在 72px（顶栏底 60px 加 12px 间距）；隐藏时升到 24px，
  // 给顶栏 12px 悬停带让位。
  const stickyTop = $derived(topbarVisibility.visible ? "72px" : "24px");

  function measure(): void {
    if (!titleEl) return;
    const paddingTop = innerEl ? Number.parseFloat(getComputedStyle(innerEl).paddingTop) : 0;
    const barHeight = titleEl.offsetHeight + paddingTop;
    const promoHeight = promoContentEl?.offsetHeight ?? 0;
    document.documentElement.style.setProperty("--page-title-bar-height", `${barHeight}px`);
    document.documentElement.style.setProperty("--page-promo-height", `${promoHeight}px`);
    ready = true;
  }

  $effect(() => {
    measure();
    if (!titleEl) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(titleEl);
    if (promoContentEl) observer.observe(promoContentEl);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--page-title-bar-height");
      document.documentElement.style.removeProperty("--page-promo-height");
    };
  });

  $effect(() => {
    document.documentElement.style.setProperty("--page-title-bar-top", stickyTop);
    return () => {
      document.documentElement.style.removeProperty("--page-title-bar-top");
    };
  });
</script>

<style>
  .page-hero {
    position: relative;
    /* 背景铺满内容列，标题仍收在 1000px 内；两侧透明区放行点击 */
    width: var(--page-hero-bar-width, 100%);
    margin-inline: auto;
    pointer-events: none;
    transition: top 150ms ease-out;
    isolation: isolate;
  }

  .page-hero.no-promo {
    margin-bottom: 2.5rem;
  }

  .page-hero-inner {
    position: relative;
    pointer-events: auto;
  }

  .page-hero-promo-content {
    max-height: min(52vh, 420px);
    overflow: clip;
  }

  @supports ((animation-timeline: scroll()) and (animation-range: 0% 100%)) {
    .page-hero.hero-ready {
      position: sticky;
      z-index: 900;
    }

    .page-hero.hero-ready::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background: color-mix(in srgb, var(--color-background) 72%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--color-white-10);
      opacity: 0;
      animation: page-hero-bar-in linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 24px;
    }

    .page-hero-promo {
      display: grid;
      grid-template-rows: 1fr;
    }

    .page-hero.hero-ready .page-hero-promo {
      animation: page-hero-collapse linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 var(--page-promo-height, 0px);
    }

    .page-hero-promo-inner {
      min-height: 0;
      overflow: clip;
    }
  }

  @keyframes page-hero-collapse {
    0% {
      grid-template-rows: 1fr;
      opacity: 1;
      visibility: visible;
    }

    99% {
      grid-template-rows: 0fr;
      opacity: 0;
      visibility: visible;
    }

    100% {
      grid-template-rows: 0fr;
      opacity: 0;
      visibility: hidden;
    }
  }

  @keyframes page-hero-bar-in {
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page-hero.hero-ready {
      position: static;
      transition: none;
    }

    .page-hero.hero-ready .page-hero-promo {
      display: block;
      animation: none;
    }

    .page-hero.hero-ready::before {
      display: none;
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .page-hero.hero-ready::before {
      background: var(--color-background);
      backdrop-filter: none;
    }
  }
</style>

<header class="page-hero" class:hero-ready={ready} class:no-promo={!promo} style="top: {stickyTop}">
  <div bind:this={innerEl} class="page-hero-inner mx-auto w-full max-w-[1000px] pt-6">
    <h1
      {id}
      bind:this={titleEl}
      class="page-title m-0 {clamp ? 'line-clamp-2' : ''} {align === 'center' ? 'text-center' : ''}"
      title={titleText}
    >
      {@render title()}
    </h1>
    {#if promo}
      <div class="page-hero-promo">
        <div class="page-hero-promo-inner">
          <div bind:this={promoContentEl} class="page-hero-promo-content pt-6 pb-10">
            {@render promo()}
          </div>
        </div>
      </div>
    {/if}
  </div>
</header>
