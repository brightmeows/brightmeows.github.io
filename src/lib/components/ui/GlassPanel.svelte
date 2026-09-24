<script lang="ts">
  import type { Snippet } from "svelte";

  import { styleToString } from "$lib/utils/style";

  interface Props {
    /** 子元素内容 */
    children?: Snippet;
    /** 自定义类名 */
    class?: string;
    /** 内边距变体 */
    padding?: "none" | "sm" | "md" | "lg";
    /** 圆角变体 */
    rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full";
    /** 是否添加 overflow-hidden（默认 true，适合浮动面板） */
    overflow?: boolean;
    /** 自定义样式对象 */
    style?: Record<string, string>;
    /** 元素ID */
    id?: string;
  }

  let {
    children,
    class: className = "",
    padding = "md",
    rounded = "lg",
    overflow = true,
    style = {},
    id,
  }: Props = $props();

  const paddingConfig = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  const roundedConfig = {
    none: "",
    sm: "rounded-glass-sm",
    md: "rounded-glass-md",
    lg: "rounded-glass-lg",
    xl: "rounded-glass-xl",
    full: "rounded-full",
  };
</script>

<div
  {id}
  class="glass-base glass-shadow-sm border border-white/20 bg-glass {paddingConfig[
    padding
  ]} {roundedConfig[rounded]} {className}"
  class:overflow-hidden={overflow}
  style={styleToString(style)}
>
  {#if children}
    {@render children()}
  {/if}
</div>
