<script lang="ts">
  import type { Snippet } from "svelte";

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
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const roundedConfig = {
    none: "",
    sm: "rounded-lg",
    md: "rounded-xl",
    lg: "rounded-2xl",
    xl: "rounded-[20px]",
    full: "rounded-full",
  };

  const styleString = $derived(
    Object.keys(style).length > 0
      ? Object.entries(style)
          .map(([k, v]) => `${k}:${v}`)
          .join(";")
      : undefined
  );
</script>

<div
  {id}
  class="glass-base glass-panel-shadow border border-white/20 bg-white/10 {paddingConfig[padding]} {roundedConfig[
    rounded
  ]} {className}"
  class:overflow-hidden={overflow}
  style={styleString}
>
  {#if children}
    {@render children()}
  {/if}
</div>
