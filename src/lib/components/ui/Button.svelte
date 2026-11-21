<script lang="ts">
  import type { Snippet } from "svelte";

  import { styleToString } from "#lib/utils/ui/style.js";

  /**
   * 文字按钮家族的唯一入口（纯语义轴分类）：primary 主操作胶囊、ghost
   * 玻璃次操作、danger 危险动作、gradient 三色渐变。视觉形态定义本体，
   * 皮肤指纹规则豁免（check-ui-tokens.py 对 ui/ 目录不检 button 皮肤）。
   * 档位语义全站唯一：xs=行内密集、sm=面板行、md=页面级；物理值按行
   * 归组（胶囊、玻璃文字、渐变三行各有三档），与 IconButton、MenuItem
   * 共用同一套档位语义。动效：玻璃系与 primary 纯变色，渐变上浮；
   * 全家族统一 transition-all 200ms 与 focus-visible ring。
   */
  type Variant =
    | "primary"
    | "ghost"
    | "danger"
    | "gradient-blue"
    | "gradient-orange"
    | "gradient-green";
  type Size = "xs" | "sm" | "md";

  interface Props {
    /** 按钮文本或内容 */
    children?: Snippet;
    /** 提供后渲染为 a 元素（去下划线）；与 disabled 同传时按禁用按钮渲染 */
    href?: string;
    /** 外链形态：target=_blank 加 rel=noopener noreferrer（仅 href 生效） */
    external?: boolean;
    type?: "button" | "submit" | "reset";
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    onclick?: (event: Event) => void;
    title?: string;
    class?: string;
    style?: Record<string, string>;
  }

  let {
    children,
    href,
    external = false,
    type = "button",
    variant = "ghost",
    size = "sm",
    disabled = false,
    onclick,
    title,
    class: className = "",
    style = {},
  }: Props = $props();

  const base =
    "inline-flex items-center justify-center gap-[0.3rem] whitespace-nowrap transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:opacity-50";

  // 行乘档：物理值按行归组，胶囊行不被玻璃档压缩
  const glassSizes = {
    xs: "px-2 py-[0.35rem] text-[0.85rem]",
    sm: "px-2.5 py-1 text-[0.85rem]",
    md: "px-3 py-1.5 text-[0.9rem]",
  };
  const capsuleSizes = {
    xs: "px-6 py-2.5 text-[1rem]",
    sm: "px-6 py-2.5 text-[1rem]",
    md: "px-8 py-3 text-[1rem]",
  };
  const gradientSizes = {
    xs: "px-3 py-[0.5rem] text-sm",
    sm: "px-[0.8rem] py-2 text-[0.9rem]",
    md: "px-5 py-[0.7rem] text-base",
  };

  const rowOf: Record<Variant, Record<Size, string>> = {
    primary: capsuleSizes,
    ghost: glassSizes,
    danger: glassSizes,
    "gradient-blue": gradientSizes,
    "gradient-orange": gradientSizes,
    "gradient-green": gradientSizes,
  };

  // 皮：静态皮加 hover 加家族动效（渐变上浮，其余纯变色）
  const skinOf: Record<Variant, string> = {
    primary:
      "rounded-[25px] border-none bg-accent-deep font-semibold text-white hover:bg-accent-deep-hover",
    ghost:
      "rounded-glass-sm border border-white-20 bg-white-10 text-white-80 hover:bg-white-20 hover:text-white",
    danger:
      "rounded-glass-sm border border-red-300/30 bg-red-400/10 text-red-200 hover:bg-red-400/20",
    "gradient-blue":
      "rounded-glass-sm border-none font-semibold text-white hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] bg-[linear-gradient(135deg,var(--color-blue-from),var(--color-blue-to))] hover:bg-[linear-gradient(135deg,var(--color-blue-hover-from),var(--color-blue-hover-to))]",
    "gradient-orange":
      "rounded-glass-sm border-none font-semibold text-white hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] bg-[linear-gradient(135deg,var(--color-orange-from),var(--color-orange-to))] hover:bg-[linear-gradient(135deg,var(--color-orange-hover-from),var(--color-orange-hover-to))]",
    "gradient-green":
      "rounded-glass-sm border-none font-semibold text-white hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] bg-[linear-gradient(135deg,var(--color-green-from),var(--color-green-to))] hover:bg-[linear-gradient(135deg,var(--color-green-hover-from),var(--color-green-hover-to))]",
  };

  const skin = $derived(skinOf[variant]);
  const sizeClass = $derived(rowOf[variant][size]);
  const cursorClass = $derived(disabled ? "cursor-not-allowed" : "cursor-pointer");
</script>

<!-- href 与 disabled 同传时按禁用按钮渲染（a 无禁用语义）；href 缺省为普通按钮 -->
{#if href && !disabled}
  <a
    {href}
    target={external ? "_blank" : undefined}
    rel={external ? "noopener noreferrer" : undefined}
    {onclick}
    {title}
    class="{base} {skin} {sizeClass} {cursorClass} no-underline {className}"
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
    {title}
    class="{base} {skin} {sizeClass} {cursorClass} {className}"
    style={styleToString(style)}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
