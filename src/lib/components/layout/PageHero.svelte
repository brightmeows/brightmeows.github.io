<script lang="ts">
  import type { Snippet } from "svelte";

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
</script>

<style>
  .page-hero.no-promo {
    margin-bottom: 2.5rem;
  }

  /* 星空画布是 fixed z-0 的定位元素，静态 hero 必须自建层叠上下文才画在它上方。 */
  .page-hero-inner {
    position: relative;
    isolation: isolate;
  }
</style>

<header class="page-hero" class:no-promo={!promo}>
  <div class="page-hero-inner mx-auto w-full max-w-[1000px] pt-6">
    <h1
      {id}
      class="page-title m-0 {clamp ? 'line-clamp-2' : ''} {align === 'center' ? 'text-center' : ''}"
      title={titleText}
    >
      {@render title()}
    </h1>
    {#if promo}
      <div class="page-hero-promo pt-6 pb-10">
        {@render promo()}
      </div>
    {/if}
  </div>
</header>
