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

  const panelStyleString = $derived(
    Object.entries({
      "background-color": "rgba(255, 255, 255, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      "box-shadow": "0 4px 30px rgba(0, 0, 0, 0.1)",
      transition: "background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
      ...style,
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";")
  );
</script>

<div
  {id}
  class="relative text-white backdrop-blur {paddingConfig[padding]} {roundedConfig[
    rounded
  ]} {className}"
  class:overflow-hidden={overflow}
  style={panelStyleString}
>
  {#if children}
    {@render children()}
  {/if}
</div>
