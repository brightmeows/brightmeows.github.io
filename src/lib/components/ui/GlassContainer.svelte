<script lang="ts">
  import type { Snippet } from "svelte";

  import { styleToString } from "$lib/utils/style";

  interface Props {
    /** 子元素内容 */
    children?: Snippet;
    /** 自定义类名 */
    class?: string;
    /** 内边距变体 */
    padding?: "none" | "sm" | "md" | "lg" | "xl";
    /** 圆角变体 */
    rounded?: "sm" | "md" | "lg" | "xl";
    /** 是否添加动画 */
    animate?: boolean;
    /** 背景透明度变体 */
    variant?: "default" | "light" | "dark";
    /** 自定义样式对象 */
    style?: Record<string, string>;
    /** 元素ID */
    id?: string;
  }

  let {
    children,
    class: className = "",
    padding = "lg",
    rounded = "xl",
    animate = false,
    variant = "default",
    style = {},
    id,
  }: Props = $props();

  const paddingConfig = {
    none: "p-0",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
    xl: "p-8",
  };

  const roundedConfig = {
    sm: "rounded-glass-sm",
    md: "rounded-glass-md",
    lg: "rounded-glass-lg",
    xl: "rounded-glass-xl",
  };

  const variantClass = $derived(
    variant === "default"
      ? "bg-white/10 border border-white/10"
      : variant === "light"
        ? "bg-white/15 border border-white/15"
        : "bg-black/20 border border-white/5"
  );
</script>

<div
  {id}
  class="glass-base glass-shadow-md block {variantClass} {paddingConfig[padding]} {roundedConfig[
    rounded
  ]} {className}"
  class:animate-fadeIn={animate}
  style={styleToString(style)}
>
  {#if children}
    {@render children()}
  {/if}
</div>
