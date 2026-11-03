<script lang="ts">
  import type { Snippet } from "svelte";

  import { m } from "#lib/paraglide/messages.js";
  import { styleToString } from "#lib/utils/ui/style.js";

  interface Props {
    /** 图标内容 */
    children?: Snippet;
    /** 点击链接（可选） */
    href?: string;
    /** 点击类型 */
    type?: "button" | "submit" | "reset";
    /** 颜色变体 */
    variant?: "primary" | "warning" | "mocha" | "minir";
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
    variant = "primary",
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

  const variantClass = $derived(`icon-btn-${variant}`);
</script>

<style>
  .icon-btn-base {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 9999px;
    padding: 0;
    color: var(--color-on-accent);
    border: none;
    transition: all 0.2s ease-in-out;
  }
  .icon-btn-base:hover:not(.no-hover) {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  .icon-btn-base:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .icon-btn-primary {
    background: linear-gradient(135deg, var(--color-primary-from), var(--color-primary-to));
  }
  .icon-btn-primary:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--color-primary-hover-from),
      var(--color-primary-hover-to)
    );
  }

  .icon-btn-warning {
    background: linear-gradient(135deg, var(--color-warning-from), var(--color-warning-to));
  }
  .icon-btn-warning:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--color-warning-hover-from),
      var(--color-warning-hover-to)
    );
  }

  .icon-btn-mocha {
    background: linear-gradient(135deg, var(--color-mocha-from), var(--color-mocha-to));
  }
  .icon-btn-mocha:hover:not(.no-hover) {
    background: linear-gradient(135deg, var(--color-mocha-hover-from), var(--color-mocha-hover-to));
  }

  .icon-btn-minir {
    background: linear-gradient(135deg, var(--color-minir-from), var(--color-minir-to));
  }
  .icon-btn-minir:hover:not(.no-hover) {
    background: linear-gradient(135deg, var(--color-minir-hover-from), var(--color-minir-hover-to));
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
    style={styleToString(style)}
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
    style={styleToString(style)}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
