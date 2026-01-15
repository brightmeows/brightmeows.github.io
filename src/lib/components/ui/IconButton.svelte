<script lang="ts">
  interface Props {
    /** 图标内容 */
    children?: import("svelte").Snippet;
    /** 点击链接（可选） */
    href?: string;
    /** 点击类型 */
    type?: "button" | "submit" | "reset";
    /** 颜色变体 */
    variant?: "orange" | "purple" | "brown" | "cyan" | "custom";
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
    ariaLabel = "图标按钮",
    target,
    rel,
    title,
  }: Props = $props();

  const sizeConfig = {
    sm: "h-8 w-8 text-[1rem]",
    md: "h-9 w-9 text-[1.2rem]",
    lg: "h-10 w-10 text-[1.4rem]",
  };

  const iconGradientConfig: Record<
    string,
    { default: string; hover: string }
  > = {
    orange: {
      default: "linear-gradient(135deg, #ff9800, #f57c00)",
      hover: "linear-gradient(135deg, #ffb74d, #ff9800)",
    },
    purple: {
      default: "linear-gradient(135deg, #9c27b0, #7b1fa2)",
      hover: "linear-gradient(135deg, #ba68c8, #9c27b0)",
    },
    brown: {
      default: "linear-gradient(135deg, #795548, #5d4037)",
      hover: "linear-gradient(135deg, #a1887f, #795548)",
    },
    cyan: {
      default: "linear-gradient(135deg, #00bcd4, #0097a7)",
      hover: "linear-gradient(135deg, #4dd0e1, #00bcd4)",
    },
  };

  const currentGradient = $derived(
    variant === "custom" && customGradient
      ? {
        default:
          `linear-gradient(135deg, ${customGradient.start}, ${customGradient.end})`,
        hover: `linear-gradient(135deg, ${
          customGradient.hoverStart || customGradient.start
        }, ${customGradient.hoverEnd || customGradient.end})`,
      }
      : iconGradientConfig[variant],
  );

  const baseStyleString = $derived(
    Object.entries({
      background: currentGradient.default,
      border: "none",
      boxShadow: "none",
      ...style,
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";"),
  );

  const hoverStyleString = $derived(
    Object.entries({
      background: currentGradient.hover,
      boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";"),
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
    {href}
    {target}
    {rel}
    aria-label={ariaLabel}
    {title}
    class="flex cursor-pointer items-center justify-center overflow-hidden rounded-full p-0 text-white {sizeConfig[size]} {className}"
    class:hover:scale-110={hoverScale}
    class:active:scale-95={clickShrink}
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
    aria-label={ariaLabel}
    {title}
    class="flex cursor-pointer items-center justify-center overflow-hidden rounded-full border-none p-0 text-white {sizeConfig[size]} {className}"
    class:opacity-50={disabled}
    class:cursor-not-allowed={disabled}
    class:hover:scale-110={hoverScale && !disabled}
    class:active:scale-95={clickShrink && !disabled}
    style={baseStyleString}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
