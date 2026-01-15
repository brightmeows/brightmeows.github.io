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

  const variantStyles = {
    default: {
      "background-color": "rgba(255, 255, 255, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
    },
    light: {
      "background-color": "rgba(255, 255, 255, 0.15)",
      border: "1px solid rgba(255, 255, 255, 0.15)",
    },
    dark: {
      "background-color": "rgba(0, 0, 0, 0.2)",
      border: "1px solid rgba(255, 255, 255, 0.05)",
    },
  };

  const containerStyleString = $derived(
    Object.entries({
      "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.3)",
      transition:
        "background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
      ...variantStyles[variant],
      ...style,
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";"),
  );
</script>

<div
  {id}
  class="backdrop-blur relative block text-white {paddingConfig[padding]} {roundedConfig[rounded]} {className}"
  class:animate-fadeIn={animate}
  style={containerStyleString}
>
  {#if children}
    {@render children()}
  {/if}
</div>
