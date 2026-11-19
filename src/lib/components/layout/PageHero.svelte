<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** 页面标题；内容由调用方渲染，组件负责 h1 与布局 */
    title: Snippet;
    /** 标题下的一句定位；组件统一字号、行高、限宽与颜色 */
    intro?: string | undefined;
    /** 介绍下的被动元信息（日期、计数、符号）；组件统一小字样式 */
    meta?: string | undefined;
    /** 动作行；页面直接放按钮，组件负责换行、间距与对齐 */
    actions?: Snippet | undefined;
    /** 额外内容；仅首页目录使用 */
    extra?: Snippet | undefined;
    /** 标题与撑持区对齐；文章页用 start，其余默认 center */
    align?: "center" | "start";
    /** 完整标题文本，供截断后的 title 属性使用 */
    titleText?: string | undefined;
    /** 是否把标题限制为两行；索引页默认 true，详情与文章传 false */
    clamp?: boolean;
    /** 标题锚点 id（保留旧书签落点） */
    id?: string | undefined;
  }

  let {
    title,
    intro,
    meta,
    actions,
    extra,
    align = "center",
    titleText,
    clamp = true,
    id,
  }: Props = $props();

  const centered = $derived(align === "center");
  const hasSupport = $derived(Boolean(intro || meta || actions || extra));
</script>

<style>
  .page-hero.no-support {
    margin-bottom: 2.5rem;
  }

  /* 星空画布是 fixed z-0 的定位元素，静态 hero 必须自建层叠上下文才画在它上方。 */
  .page-hero-inner {
    position: relative;
    isolation: isolate;
  }
</style>

<header class="page-hero" class:no-support={!hasSupport}>
  <div class="page-hero-inner mx-auto w-full max-w-[1000px] pt-6">
    <h1
      {id}
      class="page-title m-0 {clamp ? 'line-clamp-2' : ''} {centered ? 'text-center' : ''}"
      title={titleText}
    >
      {@render title()}
    </h1>
    {#if hasSupport}
      <div class="flex flex-col gap-5 pt-6 pb-10">
        {#if intro || meta}
          <div
            class="flex flex-col gap-2 {centered
              ? 'items-center text-center'
              : 'items-start text-left'}"
          >
            {#if intro}
              <p class="m-0 max-w-[46rem] text-[1.05rem] leading-[1.5] text-white-70">
                {intro}
              </p>
            {/if}
            {#if meta}
              <p class="m-0 text-[0.9rem] text-white-60">{meta}</p>
            {/if}
          </div>
        {/if}
        {#if actions}
          <div class="flex flex-wrap gap-3 {centered ? 'justify-center' : 'justify-start'}">
            {@render actions()}
          </div>
        {/if}
        {#if extra}
          {@render extra()}
        {/if}
      </div>
    {/if}
  </div>
</header>
