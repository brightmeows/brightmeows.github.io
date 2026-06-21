<script lang="ts">
  import type { Snippet } from "svelte";

  import { styleToString } from "$lib/utils/style";

  interface Props {
    /** 子元素内容 */
    children?: Snippet;
    /** 点击链接（可选，提供后变为可点击卡片） */
    href?: string;
    /** 自定义类名 */
    class?: string;
    /** 内边距变体 */
    padding?: "sm" | "md" | "lg";
    /** 圆角变体 */
    rounded?: "sm" | "md" | "lg" | "xl";
    /** 悬停时是否上移 */
    hoverLift?: boolean;
    /** 点击时是否缩放 */
    clickShrink?: boolean;
    /** 自定义样式对象 */
    style?: Record<string, string>;
    /** 链接打开方式 */
    target?: "_blank" | "_self" | "_parent" | "_top";
    /** rel 属性（用于 target="_blank"） */
    rel?: string;
  }

  let {
    children,
    href,
    class: className = "",
    padding = "md",
    rounded = "lg",
    hoverLift = true,
    clickShrink = true,
    style = {},
    target = undefined,
    rel = undefined,
  }: Props = $props();

  const paddingConfig = {
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  const roundedConfig = {
    sm: "rounded-glass-sm",
    md: "rounded-glass-md",
    lg: "rounded-glass-lg",
    xl: "rounded-glass-xl",
  };

  const sharedClasses =
    "glass-base bg-white/10 border border-white/10 hover:bg-white/5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]";
</script>

{#if href}
  <a
    {href}
    {target}
    {rel}
    class="relative block text-white no-underline {sharedClasses} {paddingConfig[
      padding
    ]} {roundedConfig[rounded]} {hoverLift ? 'hover:-translate-y-0.5' : ''} {clickShrink
      ? 'active:translate-y-0 active:scale-95'
      : ''} {className}"
    style={styleToString(style)}
  >
    {#if children}
      {@render children()}
    {/if}
  </a>
{:else}
  <div
    role="button"
    tabindex="0"
    class="relative text-white {sharedClasses} {paddingConfig[padding]} {roundedConfig[
      rounded
    ]} {hoverLift ? 'hover:-translate-y-0.5' : ''} {clickShrink
      ? 'active:translate-y-0 active:scale-95'
      : ''} {className}"
    style={styleToString(style)}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}
