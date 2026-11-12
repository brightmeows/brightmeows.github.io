<script lang="ts">
  import type { Snippet } from "svelte";

  import { styleToString } from "#lib/utils/ui/style.js";

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
</script>

<div
  {id}
  class="glass-base glass-shadow-md block bg-glass {paddingConfig[padding]} {roundedConfig[
    rounded
  ]} {className}"
  class:animate-fadeIn={animate}
  style={styleToString(style)}
>
  {#if children}
    {@render children()}
  {/if}
</div>
