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
    /** 自定义类名 */
    class?: string;
    /** 尺寸变体 */
    size?: "sm" | "md" | "lg";
    /** 是否禁用 */
    disabled?: boolean;
    /** 悬停时是否上移 */
    hoverLift?: boolean;
    /** 点击时是否缩放 */
    clickShrink?: boolean;
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
    class: className = "",
    size = "md",
    disabled = false,
    hoverLift = true,
    clickShrink = true,
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

  const sharedClasses =
    "glass-base inline-block rounded-xl font-medium text-white no-underline bg-white/10 border border-white/20 hover:bg-white/20 hover:shadow-[0_5px_15px_rgba(0,0,0,0.2)]";
</script>

{#if href && !disabled}
  <a
    {href}
    {target}
    {rel}
    class="{sharedClasses} cursor-pointer {sizeConfig[size]} {hoverLift
      ? 'hover:-translate-y-0.5'
      : ''} {clickShrink ? 'active:translate-y-0 active:scale-95' : ''} {className}"
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
    class="{sharedClasses} {sizeConfig[size]} {hoverLift && !disabled
      ? 'hover:-translate-y-0.5'
      : ''} {clickShrink && !disabled ? 'active:translate-y-0 active:scale-95' : ''} {className}"
    class:opacity-50={disabled}
    class:cursor-not-allowed={disabled}
    class:cursor-pointer={!disabled}
    style={styleToString(style)}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
