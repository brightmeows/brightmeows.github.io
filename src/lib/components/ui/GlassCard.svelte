<script lang="ts">
  import type { Snippet } from "svelte";

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
    rounded?: "md" | "lg" | "xl";
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
    md: "rounded-[14px]",
    lg: "rounded-[16px]",
    xl: "rounded-[18px]",
  };

  const sharedClasses =
    "glass-base bg-white/10 border border-white/10 hover:bg-white/5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]";

  const styleString = $derived(
    Object.keys(style).length > 0
      ? Object.entries(style)
          .map(([k, v]) => `${k}:${v}`)
          .join(";")
      : undefined
  );
</script>

{#if href}
  <a
    {href}
    {target}
    {rel}
    class="relative block text-white no-underline {sharedClasses} {paddingConfig[
      padding
    ]} {roundedConfig[rounded]} {className}"
    class:hover:-translate-y-0.5={hoverLift}
    class:active:translate-y-0={clickShrink}
    class:active:scale-95={clickShrink}
    style={styleString}
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
    ]} {className}"
    class:hover:-translate-y-0.5={hoverLift}
    class:active:translate-y-0={clickShrink}
    class:active:scale-95={clickShrink}
    style={styleString}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}
