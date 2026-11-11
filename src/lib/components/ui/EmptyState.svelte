<script lang="ts">
  import Inbox from "@lucide/svelte/icons/inbox";
  import type { Component } from "svelte";

  interface Props {
    title: string;
    description: string;
    /** 空态主图标（lucide 组件）；默认 Inbox 表达“无内容” */
    icon?: Component;
  }

  let { title, description, icon: Icon = Inbox }: Props = $props();
</script>

<div class="empty-state">
  <div class="mb-4 flex justify-center">
    <Icon class="size-14 text-white-30" strokeWidth={1.5} aria-hidden="true" />
  </div>
  <h2 class="mb-4 text-white">{title}</h2>
  <p class="text-white-70">{description}</p>
</div>
