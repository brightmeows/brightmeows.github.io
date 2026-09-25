<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";

  interface Props {
    /** 进度 0-100（确定模式）。不确定模式时无需传此值 */
    progress?: number;
    /** 当前步骤文字 */
    message: string;
    /** 可选详情，如 "1.2MB / 2.1MB" */
    detail?: string;
    /** 标题 */
    title?: string;
    /** 变体 */
    variant?: "determinate" | "indeterminate" | "compact";
    /** 是否显示百分比徽章 */
    showPercentage?: boolean;
    /** 自定义类名 */
    class?: string;
  }

  let {
    progress = 0,
    message,
    detail,
    title = m["common.loading_data"](),
    variant = "determinate",
    showPercentage = true,
    class: className = "",
  }: Props = $props();

  let isIndeterminate = $derived(variant === "indeterminate" || progress < 0);
  let displayPercent = $derived(isIndeterminate ? 0 : Math.round(progress));
</script>

<style>
  .shimmer-bar {
    background: linear-gradient(90deg, #4caf50 0%, #64b5f6 50%, #4caf50 100%);
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>

{#if variant === "compact"}
  <div class="flex items-center gap-3 {className}">
    <div class="h-2 flex-1 overflow-hidden rounded-md bg-white/10">
      <div
        class="h-full rounded-md {isIndeterminate ? 'shimmer-bar' : 'progress-fill'}"
        style="width:{isIndeterminate ? 100 : progress}%"
      ></div>
    </div>
    <span class="text-[0.85rem] text-white/70">{message}</span>
  </div>
{:else}
  <div class="glass-loading-container {className}">
    <div class="mb-6 flex items-center justify-between">
      <h3 class="m-0 text-[1.5rem] text-white">{title}</h3>
      {#if showPercentage && !isIndeterminate}
        <div class="rounded-[20px] bg-accent/20 px-4 py-2 text-[1.2rem] font-bold text-accent">
          {displayPercent}%
        </div>
      {/if}
    </div>

    <div class="progress-track mb-6 h-3">
      {#if isIndeterminate}
        <div class="shimmer-bar h-full w-full rounded-md"></div>
      {:else}
        <div class="progress-fill" style="width:{progress}%"></div>
      {/if}
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-[0.9rem] text-white/60">{m["progress.current_step"]()}:</span>
      <span class="font-medium text-white">{message}</span>
      {#if detail}
        <span class="text-[0.85rem] text-white/50">{detail}</span>
      {/if}
    </div>
  </div>
{/if}
