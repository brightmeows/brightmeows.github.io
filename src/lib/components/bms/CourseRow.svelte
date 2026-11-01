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

<div class="rounded-lg border border-white-10 bg-white/[0.03]">
  <div class="flex flex-wrap items-start gap-3 p-3">
    <div class="min-w-0 flex-1">{@render summary()}</div>
    <div class="flex flex-wrap items-center gap-1">{@render actions()}</div>
  </div>
  {#if expanded}
    <div class="border-t border-white-10 p-3">{@render children()}</div>
  {/if}
</div>
