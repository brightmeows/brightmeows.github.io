<script lang="ts">
  import Inbox from "@lucide/svelte/icons/inbox";
  import type { Component } from "svelte";

  interface Props {
    title: string;
    description: string;
    /** 空态主图标（lucide 组件）；默认 Inbox 表达“无内容” */
    icon?: Component;
    /** 标题层级：页面内容区直挂时用 2，位于已有 h2 区段内时用 3 */
    headingLevel?: 2 | 3;
  }

  let { title, description, icon: Icon = Inbox, headingLevel = 2 }: Props = $props();
</script>

<div class="empty-state">
  <div class="mb-4 flex justify-center">
    <Icon class="size-14 text-white-30" strokeWidth={1.5} aria-hidden="true" />
  </div>
  <svelte:element this={`h${headingLevel}`} class="mb-4 text-white">{title}</svelte:element>
  <p class="text-white-70">{description}</p>
</div>
