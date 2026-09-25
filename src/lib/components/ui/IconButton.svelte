<script lang="ts">
  import type { Snippet } from "svelte";

  import { m } from "$lib/paraglide/messages.js";
  import { styleToString } from "$lib/utils/style";

  interface Props {
    /** 图标内容 */
    children?: Snippet;
    /** 点击链接（可选） */
    href?: string;
    /** 点击类型 */
    type?: "button" | "submit" | "reset";
    /** 颜色变体 */
    variant?: "orange" | "purple" | "brown" | "cyan" | "blue" | "custom";
    /** 自定义渐变颜色（仅当 variant="custom" 时使用） */
    customGradient?: {
      start: string;
      end: string;
      hoverStart?: string;
      hoverEnd?: string;
    };
    /** 尺寸变体 */
    size?: "sm" | "md" | "lg";
    /** 自定义类名 */
    class?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 悬停时是否放大 */
    hoverScale?: boolean;
    /** 点击时是否缩放 */
    clickShrink?: boolean;
    /** 自定义样式对象 */
    style?: Record<string, string>;
    /** 点击事件处理 */
    onclick?: (event: Event) => void;
    /** 无障碍标签 */
    ariaLabel?: string;
    /** 链接打开方式 */
    target?: "_blank" | "_self" | "_parent" | "_top";
    /** rel 属性 */
    rel?: string;
    /** title 属性 */
    title?: string;
  }

  let {
    children,
    href,
    type = "button",
    variant = "orange",
    customGradient,
    size = "md",
    class: className = "",
    disabled = false,
    hoverScale = true,
    clickShrink = true,
    style = {},
    onclick,
    ariaLabel = m["iconbutton.default"](),
    target,
    rel,
    title,
  }: Props = $props();

  const sizeConfig = {
    sm: "h-8 w-8 text-[1rem]",
    md: "h-9 w-9 text-[1.2rem]",
    lg: "h-10 w-10 text-[1.4rem]",
  };

  const variantClass = $derived(variant === "custom" ? "icon-btn-custom" : `icon-btn-${variant}`);

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
</script>

<style>
  .icon-btn-base {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 9999px;
    padding: 0;
    color: white;
    border: none;
    transition: all 0.2s ease-in-out;
  }
  .icon-btn-base:hover:not(.no-hover) {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .icon-btn-orange {
    background: linear-gradient(135deg, var(--color-orange-from), var(--color-orange-to));
  }
  .icon-btn-orange:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--color-orange-hover-from),
      var(--color-orange-hover-to)
    );
  }

  .icon-btn-purple {
    background: linear-gradient(135deg, var(--color-purple-from), var(--color-purple-to));
  }
  .icon-btn-purple:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--color-purple-hover-from),
      var(--color-purple-hover-to)
    );
  }

  .icon-btn-brown {
    background: linear-gradient(135deg, var(--color-brown-from), var(--color-brown-to));
  }
  .icon-btn-brown:hover:not(.no-hover) {
    background: linear-gradient(135deg, var(--color-brown-hover-from), var(--color-brown-hover-to));
  }

  .icon-btn-cyan {
    background: linear-gradient(135deg, var(--color-cyan-from), var(--color-cyan-to));
  }
  .icon-btn-cyan:hover:not(.no-hover) {
    background: linear-gradient(135deg, var(--color-cyan-hover-from), var(--color-cyan-hover-to));
  }

  .icon-btn-blue {
    background: linear-gradient(135deg, var(--color-blue-from), var(--color-blue-to));
  }
  .icon-btn-blue:hover:not(.no-hover) {
    background: linear-gradient(135deg, var(--color-blue-hover-from), var(--color-blue-hover-to));
  }

  .icon-btn-custom {
    background: linear-gradient(135deg, var(--grad-start), var(--grad-end));
  }
  .icon-btn-custom:hover:not(.no-hover) {
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
    aria-label={ariaLabel}
    {title}
    class="icon-btn-base cursor-pointer {variantClass} {sizeConfig[size]} {hoverScale && !disabled
      ? 'hover:scale-110'
      : ''} {clickShrink && !disabled ? 'active:scale-95' : ''} {className}"
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
    aria-label={ariaLabel}
    {title}
    class="icon-btn-base {variantClass} {sizeConfig[size]} {hoverScale && !disabled
      ? 'hover:scale-110'
      : ''} {clickShrink && !disabled ? 'active:scale-95' : ''} {className}"
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
