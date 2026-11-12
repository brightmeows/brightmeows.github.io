<script lang="ts">
  import type { Snippet } from "svelte";

  import { popoverLayer } from "#lib/components/ui/popover-layer.js";
  import { menuPosition } from "#lib/utils/ui/menu-position.js";

  /**
   * 点击型浮动菜单原语：触发钮加 popover-glass 弹层，封装视口钳制定位、
   * 外点/Esc/滚动关闭与 top-layer 提升（经 popoverLayer，backdrop-filter
   * 不被玻璃祖先截断）。作普通弹层按钮组用：未实现方向键契约就不占 menu
   * 角色；Esc 与菜单项激活后焦点归还触发钮；弹层自身可滚动时内部滚动不
   * 关闭。菜单项布局与选中行为由 content snippet 承担，close 供其点击后
   * 收起。悬停型下拉不走这里（dropdown-panel 原语）。
   */

  interface Props {
    /** 触发钮无障碍名，同时作 title。 */
    label: string;
    /** 触发钮类串（传 ui-classes 令牌：btnIcon、chartLinkIcon 等）。 */
    triggerClass: string;
    /** 弹层宽度估算（定位钳制用）。 */
    width: number;
    /** 弹层竖向越界时的视口下缘预留。 */
    bottomReserve: number;
    /** 弹层对齐：right 为右缘对齐触发钮（行尾钮），left 为左缘对齐。 */
    align?: "left" | "right";
    /** 弹层附加类（宽度、内边距、溢出滚动）。 */
    menuClass?: string;
    disabled?: boolean;
    /** 触发钮内容（图标）。 */
    children: Snippet;
    /** 弹层内容；close 供菜单项点击后收起。 */
    content: Snippet<[{ close(): void }]>;
  }

  let {
    label,
    triggerClass,
    width,
    bottomReserve,
    align = "left",
    menuClass = "",
    disabled = false,
    children,
    content,
  }: Props = $props();

  let trigger = $state<HTMLButtonElement | undefined>(undefined);
  let menuEl = $state<HTMLDivElement | undefined>(undefined);
  let open = $state(false);
  let posStyle = $state("");

  /** 关闭并归还触发钮焦点：Esc 与菜单项激活走这里，外点与滚动不打扰焦点。 */
  function close(): void {
    open = false;
    trigger?.focus();
  }

  function toggle(): void {
    if (open) {
      open = false;
      return;
    }
    if (trigger === undefined) return;
    const rect = trigger.getBoundingClientRect();
    posStyle = menuPosition({
      anchor: { left: rect.left, right: rect.right, bottom: rect.bottom },
      width,
      align,
      bottomReserve,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    });
    open = true;
  }

  $effect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node) {
        if (menuEl?.contains(event.target) || trigger?.contains(event.target)) return;
      }
      open = false;
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    const onScroll = (event: Event): void => {
      // 弹层自身可滚动（overflow-auto）时内部滚动不算页面滚动
      if (event.target instanceof Node && menuEl?.contains(event.target)) return;
      open = false;
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  });
</script>

<button
  class={triggerClass}
  type="button"
  bind:this={trigger}
  aria-label={label}
  aria-expanded={open}
  title={label}
  {disabled}
  onclick={toggle}
>
  {@render children()}
</button>

{#if open}
  <div class="popover-glass {menuClass}" style={posStyle} bind:this={menuEl} use:popoverLayer>
    {@render content({ close })}
  </div>
{/if}
