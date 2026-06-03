<script lang="ts">
  interface Props {
    /** 子元素内容 */
    children?: import("svelte").Snippet;
    /** 自定义类名 */
    class?: string;
    /** 内边距变体 */
    padding?: "none" | "sm" | "md" | "lg";
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
    md: "p-6",
    lg: "p-8",
  };

  const roundedConfig = {
    sm: "rounded-[10px]",
    md: "rounded-[14px]",
    lg: "rounded-[18px]",
    xl: "rounded-[20px]",
  };

  const variantClass = $derived(
    variant === "default"
      ? "bg-white/10 border border-white/10"
      : variant === "light"
        ? "bg-white/15 border border-white/15"
        : "bg-black/20 border border-white/5"
  );

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
  class="glass-base glass-container-shadow block {variantClass} {paddingConfig[padding]} {roundedConfig[
    rounded
  ]} {className}"
  class:animate-fadeIn={animate}
  style={styleString}
>
  {#if children}
    {@render children()}
  {/if}
</div>
