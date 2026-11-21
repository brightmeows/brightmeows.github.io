<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * 弹层菜单行家族的唯一入口：sm 是行内弹层（ClickPopover 内容行的
   * “...”菜单），md 是顶栏弹层（主题/语言/账户下拉与窄屏菜单）。
   * danger 变体承载删除等破坏性动作。href 提供后渲染为 a（顶栏菜单
   * 有链接形态）。动效纯变色；统一 transition-all 200ms 与 focus ring
   * （两族旧实现均无 ring，此处补齐）。
   */
  type Variant = "default" | "danger";
  type Size = "sm" | "md";

  interface Props {
    children?: Snippet;
    variant?: Variant;
    size?: Size;
    href?: string;
    disabled?: boolean;
    onclick?: (event: Event) => void;
    title?: string;
    class?: string;
  }

  let {
    children,
    variant = "default",
    size = "sm",
    href,
    disabled = false,
    onclick,
    title,
    class: className = "",
  }: Props = $props();

  const base =
    "cursor-pointer text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

  // 行乘档：菜单行两档，sm=行内弹层（w-full 占满弹层宽）、md=顶栏弹层
  const skinOf: Record<Size, Record<Variant, string>> = {
    sm: {
      default:
        "flex w-full items-center rounded-glass-sm px-2 py-1.5 text-[0.85rem] text-white-80 hover:bg-white-10 hover:text-white",
      danger:
        "flex w-full items-center rounded-glass-sm px-2 py-1.5 text-[0.85rem] text-error hover:bg-error/10",
    },
    md: {
      default:
        "flex items-center gap-2 rounded-glass-md px-3 py-2 text-sm text-white-90 hover:bg-white-10",
      danger:
        "flex items-center gap-2 rounded-glass-md px-3 py-2 text-sm text-error hover:bg-error/10",
    },
  };

  const skinClass = $derived(skinOf[size][variant]);
  const cursorClass = $derived(disabled ? "cursor-not-allowed" : "cursor-pointer");
</script>

{#if href && !disabled}
  <a {href} {onclick} {title} class="{base} {skinClass} {cursorClass} no-underline {className}">
    {#if children}
      {@render children()}
    {/if}
  </a>
{:else}
  <button
    type="button"
    {disabled}
    {onclick}
    {title}
    class="{base} {skinClass} {cursorClass} w-full {className}"
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
