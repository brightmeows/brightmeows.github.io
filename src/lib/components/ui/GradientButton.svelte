<script lang="ts">
  import type { Snippet } from "svelte";

  import { styleToString } from "$lib/utils/style";

  interface Props {
    /** 按钮文本或内容 */
    children?: Snippet;
    /** 点击链接（可选，提供后渲染为 <a>） */
    href?: string;
    /** 点击类型 */
    type?: "button" | "submit" | "reset";
    /** 颜色变体 */
    variant?: "green" | "blue" | "orange" | "custom";
    /** 自定义渐变颜色（仅当 variant="custom" 时使用） */
    customGradient?: {
      start: string;
      end: string;
      hoverStart?: string;
      hoverEnd?: string;
    };
    /** 自定义类名 */
    class?: string;
    /** 尺寸变体 */
    size?: "sm" | "md" | "lg";
    /** 是否禁用 */
    disabled?: boolean;
    /** 悬停时是否上移 */
    hoverLift?: boolean;
    /** 自定义样式对象 */
    style?: Record<string, string>;
    /** 点击事件处理 */
    onclick?: (event: Event) => void;
    /** 链接打开方式 */
    target?: "_blank" | "_self" | "_parent" | "_top";
    /** rel 属性 */
    rel?: string;
  }

  let {
    children,
    href,
    type = "button",
    variant = "green",
    customGradient,
    class: className = "",
    size = "sm",
    disabled = false,
    hoverLift = true,
    style = {},
    onclick,
    target,
    rel,
  }: Props = $props();

  const sizeConfig = {
    sm: "px-3 py-[0.5rem] text-sm",
    md: "px-5 py-[0.7rem] text-base",
    lg: "px-7 py-[0.9rem] text-lg",
  };

  const variantClass = $derived(
    variant === "custom" ? "gradient-btn-custom" : `gradient-btn-${variant}`
  );

  const resolvedStyle = $derived(
    variant === "custom" && customGradient
      ? {
          "--grad-start": customGradient.start,
          "--grad-end": customGradient.end,
          "--grad-hover-start": customGradient.hoverStart ?? customGradient.start,
          "--grad-hover-end": customGradient.hoverEnd ?? customGradient.end,
          ...style,
        }
      : style
  );

  const liftClass = $derived(hoverLift && !disabled ? "-translate-y-0.5" : "");
</script>

<style>
  .gradient-btn-base {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    color: white;
    text-decoration: none;
    transition: all 0.2s ease-in-out;
  }
  .gradient-btn-base:hover:not(.no-hover) {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .gradient-btn-green {
    background: linear-gradient(135deg, var(--color-green-from), var(--color-green-to));
  }
  .gradient-btn-green:hover:not(.no-hover) {
    background: linear-gradient(135deg, var(--color-green-hover-from), var(--color-green-hover-to));
  }

  .gradient-btn-blue {
    background: linear-gradient(135deg, var(--color-blue-from), var(--color-blue-to));
  }
  .gradient-btn-blue:hover:not(.no-hover) {
    background: linear-gradient(135deg, var(--color-blue-hover-from), var(--color-blue-hover-to));
  }

  .gradient-btn-orange {
    background: linear-gradient(135deg, var(--color-orange-from), var(--color-orange-to));
  }
  .gradient-btn-orange:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--color-orange-hover-from),
      var(--color-orange-hover-to)
    );
  }

  .gradient-btn-custom {
    background: linear-gradient(135deg, var(--grad-start), var(--grad-end));
  }
  .gradient-btn-custom:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--grad-hover-start, var(--grad-start)),
      var(--grad-hover-end, var(--grad-end))
    );
  }
</style>

{#if href && !disabled}
  <a
    {href}
    {target}
    {rel}
    class="gradient-btn-base {variantClass} {sizeConfig[size]} {liftClass} {!disabled
      ? 'active:translate-y-0 active:scale-95'
      : ''} {className}"
    class:no-hover={disabled}
    style={styleToString(resolvedStyle)}
  >
    {#if children}
      {@render children()}
    {/if}
  </a>
{:else}
  <button
    {type}
    {disabled}
    {onclick}
    class="gradient-btn-base {variantClass} {sizeConfig[size]} {hoverLift && !disabled
      ? 'hover:-translate-y-0.5'
      : ''} {!disabled ? 'active:translate-y-0 active:scale-95' : ''} {className}"
    class:opacity-50={disabled}
    class:cursor-not-allowed={disabled}
    class:cursor-pointer={!disabled}
    class:no-hover={disabled}
    style={styleToString(resolvedStyle)}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
