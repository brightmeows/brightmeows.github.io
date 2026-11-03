<script lang="ts">
  import type { Snippet } from "svelte";

  import { styleToString } from "#lib/utils/ui/style.js";

  interface Props {
    /** 按钮文本或内容 */
    children?: Snippet;
    /** 点击链接（可选，提供后渲染为 <a>） */
    href?: string;
    /** 点击类型 */
    type?: "button" | "submit" | "reset";
    /** 颜色变体 */
    variant?: "primary" | "success" | "warning";
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
    variant = "primary",
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

  const variantClass = $derived(`gradient-btn-${variant}`);

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
    color: var(--color-on-accent);
    text-decoration: none;
    transition: all 0.2s ease-in-out;
  }
  .gradient-btn-base:hover:not(.no-hover) {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  .gradient-btn-base:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .gradient-btn-primary {
    background: linear-gradient(135deg, var(--color-primary-from), var(--color-primary-to));
  }
  .gradient-btn-primary:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--color-primary-hover-from),
      var(--color-primary-hover-to)
    );
  }

  .gradient-btn-success {
    background: linear-gradient(135deg, var(--color-success-from), var(--color-success-to));
  }
  .gradient-btn-success:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--color-success-hover-from),
      var(--color-success-hover-to)
    );
  }

  .gradient-btn-warning {
    background: linear-gradient(135deg, var(--color-warning-from), var(--color-warning-to));
  }
  .gradient-btn-warning:hover:not(.no-hover) {
    background: linear-gradient(
      135deg,
      var(--color-warning-hover-from),
      var(--color-warning-hover-to)
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
    class="gradient-btn-base {variantClass} {sizeConfig[size]} {hoverLift && !disabled
      ? 'hover:-translate-y-0.5'
      : ''} {!disabled ? 'active:translate-y-0 active:scale-95' : ''} {className}"
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
