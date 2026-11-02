<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * 段位行壳：查看态与编辑态共用边框、摘要区、操作区与展开区。
   * 摘要与操作由调用方提供 snippet；展开内容只在 expanded 时渲染。
   */
  interface Props {
    expanded: boolean;
    summary: Snippet;
    actions: Snippet;
    children: Snippet;
  }

  let { expanded, summary, actions, children }: Props = $props();
</script>

<div class="border-b border-white-10 transition-colors last:border-b-0 hover:bg-white-5">
  <div class="flex flex-wrap items-start gap-3 px-1 py-3">
    <div class="min-w-0 flex-1">{@render summary()}</div>
    <div class="flex flex-wrap items-center gap-1">{@render actions()}</div>
  </div>
  {#if expanded}
    <div class="border-t border-white-10 px-1 pt-3 pb-3">{@render children()}</div>
  {/if}
</div>
