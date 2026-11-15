<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** 页面标题；内容由调用方渲染，组件只负责 h1 与布局 */
    title: Snippet;
    /** 标题下的宣传内容（说明、入口按钮等）；不传则只有标题 */
    promo?: Snippet | undefined;
    /** 标题对齐；文章页用 start，其余默认 center */
    align?: "center" | "start";
  }

  let { title, promo, align = "center" }: Props = $props();
</script>

<header class="page-hero pt-6 pb-10">
  <h1 class="page-title m-0 {align === 'center' ? 'text-center' : ''}">
    {@render title()}
  </h1>
  {#if promo}
    <div class="mt-6">
      {@render promo()}
    </div>
  {/if}
</header>
