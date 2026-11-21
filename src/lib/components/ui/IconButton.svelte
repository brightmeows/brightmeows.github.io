<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * 图标按钮家族的唯一入口（纯语义轴分类）：方形透明（default/plain/
   * danger）、方形描边（outline）、圆形透明与实底（circle/circle-solid，
   * 顶栏与内容区共用同一家族）、圆形渐变（gradient-*，品牌色外链图标
   * 钮）。档位语义全站唯一：xs=24px、sm=28px、md=36px，与 Button、
   * MenuItem 共用档位语义。动效：渐变皮悬停缩放，其余纯变色；全家族
   * 统一 transition-all 200ms 与 focus-visible ring。ariaLabel 必填：
   * 图标钮没有文字，无名图标按钮是可访问性缺陷。
   */
  type Skin =
    | "default"
    | "plain"
    | "danger"
    | "outline"
    | "circle"
    | "circle-solid"
    | "gradient-blue"
    | "gradient-orange"
    | "gradient-brown"
    | "gradient-cyan";
  type Size = "xs" | "sm" | "md";

  interface Props {
    /** 图标内容（lucide 组件或品牌资产） */
    children: Snippet;
    /** 无障碍标签（必填） */
    ariaLabel: string;
    skin?: Skin;
    size?: Size;
    /** 提供后渲染为 a 元素；与 disabled 同传时按禁用按钮渲染 */
    href?: string;
    /** 外链形态：target=_blank 加 rel=noopener noreferrer（仅 href 生效） */
    external?: boolean;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    onclick?: (event: Event) => void;
    title?: string;
    class?: string;
  }

  let {
    children,
    ariaLabel,
    skin = "default",
    size = "sm",
    href,
    external = false,
    type = "button",
    disabled = false,
    onclick,
    title,
    class: className = "",
  }: Props = $props();

  const base =
    "flex shrink-0 items-center justify-center overflow-hidden p-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:opacity-50";

  // 行乘档：图标行三档边长 24/28/36px；字号随档，供未显式定尺寸的图标继承
  const sizeOf: Record<Size, string> = {
    xs: "size-6 text-[0.85rem]",
    sm: "size-7 text-[1rem]",
    md: "size-9 text-[1.2rem]",
  };

  // 皮：静态皮加 hover 加家族动效（渐变悬停缩放，其余纯变色）
  const skinOf: Record<Skin, string> = {
    default: "rounded-glass-sm text-white-60 hover:bg-white-10 hover:text-white",
    plain: "rounded-glass-sm hover:bg-white-10",
    danger: "rounded-glass-sm text-red-200/80 hover:bg-red-400/20 hover:text-red-200",
    outline:
      "rounded-glass-sm border border-white-20 bg-white-10 text-white-80 hover:bg-white-20 hover:text-white",
    circle: "rounded-full text-white-60 hover:bg-white-10 hover:text-white",
    "circle-solid": "rounded-full bg-white-15 text-white hover:bg-white-25",
    "gradient-blue":
      "rounded-full border-none text-white hover:scale-105 hover:shadow-[0_4px_8px_rgba(0,0,0,0.3)] bg-[linear-gradient(135deg,var(--color-blue-from),var(--color-blue-to))] hover:bg-[linear-gradient(135deg,var(--color-blue-hover-from),var(--color-blue-hover-to))]",
    "gradient-orange":
      "rounded-full border-none text-white hover:scale-105 hover:shadow-[0_4px_8px_rgba(0,0,0,0.3)] bg-[linear-gradient(135deg,var(--color-orange-from),var(--color-orange-to))] hover:bg-[linear-gradient(135deg,var(--color-orange-hover-from),var(--color-orange-hover-to))]",
    "gradient-brown":
      "rounded-full border-none text-white hover:scale-105 hover:shadow-[0_4px_8px_rgba(0,0,0,0.3)] bg-[linear-gradient(135deg,var(--color-brown-from),var(--color-brown-to))] hover:bg-[linear-gradient(135deg,var(--color-brown-hover-from),var(--color-brown-hover-to))]",
    "gradient-cyan":
      "rounded-full border-none text-white hover:scale-105 hover:shadow-[0_4px_8px_rgba(0,0,0,0.3)] bg-[linear-gradient(135deg,var(--color-cyan-from),var(--color-cyan-to))] hover:bg-[linear-gradient(135deg,var(--color-cyan-hover-from),var(--color-cyan-hover-to))]",
  };

  const skinClass = $derived(skinOf[skin]);
  const sizeClass = $derived(sizeOf[size]);
  const cursorClass = $derived(disabled ? "cursor-not-allowed" : "cursor-pointer");
</script>

<!-- href 与 disabled 同传时按禁用按钮渲染（a 无禁用语义）；href 缺省为普通按钮 -->
{#if href && !disabled}
  <a
    {href}
    target={external ? "_blank" : undefined}
    rel={external ? "noopener noreferrer" : undefined}
    aria-label={ariaLabel}
    {title}
    {onclick}
    class="{base} {skinClass} {sizeClass} {cursorClass} no-underline {className}"
  >
    {@render children()}
  </a>
{:else}
  <button
    {type}
    {disabled}
    {onclick}
    aria-label={ariaLabel}
    {title}
    class="{base} {skinClass} {sizeClass} {cursorClass} {className}"
  >
    {@render children()}
  </button>
{/if}
