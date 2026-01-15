<script lang="ts">
  interface Props {
    /** 子元素内容 */
    children?: import("svelte").Snippet;
    /** 点击链接（可选，提供后变为可点击卡片） */
    href?: string;
    /** 自定义类名 */
    class?: string;
    /** 内边距变体 */
    padding?: "sm" | "md" | "lg";
    /** 圆角变体 */
    rounded?: "md" | "lg" | "xl";
    /** 悬停时是否上移 */
    hoverLift?: boolean;
    /** 点击时是否缩放 */
    clickShrink?: boolean;
    /** 自定义样式对象 */
    style?: Record<string, string>;
    /** 链接打开方式 */
    target?: "_blank" | "_self" | "_parent" | "_top";
    /** rel 属性（用于 target="_blank"） */
    rel?: string;
  }

  let {
    children,
    href,
    class: className = "",
    padding = "md",
    rounded = "lg",
    hoverLift = true,
    clickShrink = true,
    style = {},
    target = undefined,
    rel = undefined,
  }: Props = $props();

  const paddingConfig = {
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  const roundedConfig = {
    md: "rounded-[14px]",
    lg: "rounded-[16px]",
    xl: "rounded-[18px]",
  };

  const baseStyleString = $derived(
    Object.entries({
      "background-color": "rgba(255, 255, 255, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      "box-shadow": "none",
      transition:
        "transform 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
      ...style,
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";"),
  );

  const hoverStyleString = $derived(
    Object.entries({
      "background-color": "rgba(255, 255, 255, 0.06)",
      "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.2)",
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";"),
  );

  function handleMouseEnter(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    target.setAttribute("style", baseStyleString + ";" + hoverStyleString);
  }

  function handleMouseLeave(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    target.setAttribute("style", baseStyleString);
  }
</script>

{#if href}
  <a
    {href}
    {target}
    {rel}
    class="backdrop-blur relative block text-white no-underline {paddingConfig[padding]} {roundedConfig[rounded]} {className}"
    class:hover:-translate-y-0.5={hoverLift}
    class:active:translate-y-0={clickShrink}
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
  <div
    role="button"
    tabindex="0"
    class="backdrop-blur relative text-white {paddingConfig[padding]} {roundedConfig[rounded]} {className}"
    class:hover:-translate-y-0.5={hoverLift}
    class:active:translate-y-0={clickShrink}
    class:active:scale-95={clickShrink}
    style={baseStyleString}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}
