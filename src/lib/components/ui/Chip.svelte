<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * 筛选 chip 家族的唯一入口：可开关的状态控件，与动作类按钮家族分工
   * 不同。state 由消费方算好传入（受控组件）：off 常态灰描边，accent
   * 与 warning 按语义分激活色，success 是复制反馈态。状态组合在本组件
   * 内部完成，消费端不做部分类组合。动效纯变色；focus ring 沿旧令牌。
   */
  type State = "off" | "accent" | "warning" | "success";

  interface Props {
    children?: Snippet;
    state?: State;
    /** 开关语义的按压态，透传 aria-pressed；复制反馈（success）等非开关用法不传。 */
    pressed?: boolean;
    disabled?: boolean;
    onclick?: (event: Event) => void;
    title?: string;
    class?: string;
  }

  let {
    children,
    state = "off",
    pressed = undefined,
    disabled = false,
    onclick,
    title,
    class: className = "",
  }: Props = $props();

  const base =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-glass-sm border px-2 py-[0.35rem] text-[0.85rem] transition-all duration-200 select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none";

  const stateOf: Record<State, string> = {
    off: "border-white-20 text-white-50 hover:border-white-40 hover:text-white-70",
    accent: "border-accent/60 bg-accent/20 text-accent",
    warning: "border-warning/60 bg-warning/20 text-warning",
    success: "border-success/60 bg-success/20 text-success",
  };
</script>

<button
  type="button"
  {disabled}
  {onclick}
  {title}
  aria-pressed={pressed}
  class="{base} {stateOf[state]} {className}"
>
  {#if children}
    {@render children()}
  {/if}
</button>
