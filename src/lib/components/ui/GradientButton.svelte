<script lang="ts">
  import { resolve } from "$app/paths";

  interface Props {
    /** 按钮文本或内容 */
    children?: import("svelte").Snippet;
    /** 点击链接（可选，提供后渲染为 <a>） */
    href?: string;
    /** 点击类型 */
    type?: "button" | "submit" | "reset";
    /** 颜色变体 */
    variant?: "green" | "blue" | "custom";
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
    sm: "px-2 py-[0.35rem] text-[0.85rem]",
    md: "px-4 py-[0.6rem] text-base",
    lg: "px-6 py-[0.8rem] text-lg",
  };

  const hoverClass = $derived(hoverLift ? "-translate-y-0.5" : "");
  const disabledClass = $derived(disabled ? "opacity-50 cursor-not-allowed" : "");

  const gradientConfig: Record<string, { default: string; hover: string }> = {
    green: {
      default: "linear-gradient(135deg, #4caf50, #2e7d32)",
      hover: "linear-gradient(135deg, #66bb6a, #388e3c)",
    },
    blue: {
      default: "linear-gradient(135deg, #2196f3, #1565c0)",
      hover: "linear-gradient(135deg, #42a5f5, #1976d2)",
    },
  };

  const currentGradient = $derived(
    variant === "custom" && customGradient
      ? {
          default: `linear-gradient(135deg, ${customGradient.start}, ${customGradient.end})`,
          hover: `linear-gradient(135deg, ${
            customGradient.hoverStart ?? customGradient.start
          }, ${customGradient.hoverEnd ?? customGradient.end})`,
        }
      : gradientConfig[variant]
  );

  const baseStyleString = $derived(
    Object.entries({
      background: currentGradient.default,
      border: "none",
      boxShadow: "none",
      transition: "all 0.2s ease-in-out",
      ...style,
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";")
  );

  const hoverStyleString = $derived(
    Object.entries({
      background: currentGradient.hover,
      boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";")
  );

  function handleMouseEnter(event: MouseEvent) {
    if (disabled) return;
    const target = event.currentTarget as HTMLElement;
    target.setAttribute("style", baseStyleString + ";" + hoverStyleString);
  }

  function handleMouseLeave(event: MouseEvent) {
    if (disabled) return;
    const target = event.currentTarget as HTMLElement;
    target.setAttribute("style", baseStyleString);
  }
</script>

{#if href && !disabled}
  <a
    href={resolve(href, {})}
    {target}
    {rel}
    class="inline-flex items-center justify-center rounded-md font-semibold text-white no-underline {sizeConfig[
      size
    ]} {className} {hoverClass} active-translate-y-0"
    style={baseStyleString}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
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
    class="inline-flex items-center justify-center rounded-md font-semibold text-white {sizeConfig[
      size
    ]} {className} {disabledClass} {hoverClass} active-translate-y-0"
    style={baseStyleString}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
