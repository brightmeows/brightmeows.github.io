<script lang="ts">
  interface Props {
    /** 按钮文本或内容 */
    children?: import("svelte").Snippet;
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
    sm: "px-4 py-[0.6rem] text-sm",
    md: "px-6 py-[0.8rem] text-base",
    lg: "px-8 py-[1rem] text-lg",
  };

  const baseStyleString = $derived(
    Object.entries({
      "background-color": "rgba(255, 255, 255, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      "box-shadow": "none",
      transition:
        "background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease",
      ...style,
    })
      .map(([key, value]) => `${key}:${value}`)
      .join(";")
  );

  const hoverStyleString = $derived(
    Object.entries({
      "background-color": "rgba(255, 255, 255, 0.2)",
      "box-shadow": "0 5px 15px rgba(0, 0, 0, 0.2)",
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
    {href}
    {target}
    {rel}
    class="relative inline-block cursor-pointer rounded-xl font-medium text-white no-underline backdrop-blur {sizeConfig[
      size
    ]} {className}"
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
  <button
    {type}
    {disabled}
    {onclick}
    class="relative inline-block cursor-pointer rounded-xl font-medium text-white backdrop-blur {sizeConfig[
      size
    ]} {className}"
    class:opacity-50={disabled}
    class:cursor-not-allowed={disabled}
    class:hover:-translate-y-0.5={hoverLift && !disabled}
    class:active:translate-y-0={clickShrink && !disabled}
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
