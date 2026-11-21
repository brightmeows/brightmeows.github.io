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
   * hoverIntent 启用悬停意图协议：指针悬停 150ms 展开、移入面板保持、
   * 指针离开 250ms 收；pinOnClick 启用点击钉住：关闭态点击与悬停展开态
   * 的首次点击都转为钉住，钉住态下滚动不再自动关闭（外点与 Esc 仍是显
   * 式关闭）。两者独立，目录浮动件两项全开；其余调用处不传即纯点击。
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
    /** 弹层附加类（宽度、内边距）。 */
    menuClass?: string;
    /**
     * 内层滚动容器类（max-h 与 overflow-auto）。[popover] 的 UA 重置在
     * layout.css 未分层写 overflow: visible，会压过外层的溢出工具类，滚动
     * 类必须挂到这层内层容器才生效；缺省不包内层。
     */
    scrollClass?: string;
    disabled?: boolean;
    /** 启用悬停意图协议（见头注）；仅响应鼠标指针，触屏与键盘不受影响。 */
    hoverIntent?: boolean;
    /** 启用点击钉住（见头注）。 */
    pinOnClick?: boolean;
    /** 弹层开合通知：宿主据此决定是否豁免自身的滚动收起逻辑。 */
    onOpenChange?: (open: boolean) => void;
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
    scrollClass = "",
    disabled = false,
    hoverIntent = false,
    pinOnClick = false,
    onOpenChange,
    children,
    content,
  }: Props = $props();

  let trigger = $state<HTMLButtonElement | undefined>(undefined);
  let menuEl = $state<HTMLDivElement | undefined>(undefined);
  let open = $state(false);
  let posStyle = $state("");

  // 打开来源标记，纯状态机位（非响应式）：hover 态指针离开即收，pin 态
  // 滚动与指针移动都不再自动关闭。
  let openedBy: "hover" | "pin" | null = null;
  const HOVER_OPEN_DELAY = 150;
  const HOVER_CLOSE_DELAY = 250;
  let hoverOpenTimer: number | null = null;
  let hoverCloseTimer: number | null = null;

  function clearHoverTimers(): void {
    if (hoverOpenTimer !== null) {
      clearTimeout(hoverOpenTimer);
      hoverOpenTimer = null;
    }
    if (hoverCloseTimer !== null) {
      clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    }
  }

  /** 指针离开、滚动、外点等不打扰焦点的关闭路径。 */
  function dismiss(): void {
    clearHoverTimers();
    open = false;
    openedBy = null;
    onOpenChange?.(false);
  }

  /** 关闭并归还触发钮焦点：Esc 与菜单项激活走这里，外点与滚动不打扰焦点。 */
  function close(): void {
    dismiss();
    trigger?.focus();
  }

  function positionPanel(): void {
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
  }

  function openPanel(by: "hover" | "pin"): void {
    positionPanel();
    open = true;
    openedBy = by;
    onOpenChange?.(true);
  }

  function toggle(): void {
    clearHoverTimers();
    if (open) {
      // 悬停展开态的首次点击是钉住：把“指针离开即收”换成显式关闭。
      if (pinOnClick && openedBy === "hover") {
        openedBy = "pin";
        return;
      }
      dismiss();
      return;
    }
    openPanel("pin");
  }

  function onTriggerPointerEnter(event: PointerEvent): void {
    if (!hoverIntent || event.pointerType !== "mouse") return;
    clearHoverTimers();
    if (open) return;
    hoverOpenTimer = window.setTimeout(() => {
      hoverOpenTimer = null;
      openPanel("hover");
    }, HOVER_OPEN_DELAY);
  }

  function onTriggerPointerLeave(event: PointerEvent): void {
    if (!hoverIntent || event.pointerType !== "mouse") return;
    clearHoverTimers();
    if (!open || openedBy !== "hover") return;
    hoverCloseTimer = window.setTimeout(() => {
      hoverCloseTimer = null;
      if (open && openedBy === "hover") dismiss();
    }, HOVER_CLOSE_DELAY);
  }

  function onPanelPointerEnter(event: PointerEvent): void {
    if (event.pointerType !== "mouse") return;
    clearHoverTimers();
  }

  function onPanelPointerLeave(event: PointerEvent): void {
    if (event.pointerType !== "mouse" || !open || openedBy !== "hover") return;
    clearHoverTimers();
    hoverCloseTimer = window.setTimeout(() => {
      hoverCloseTimer = null;
      if (open && openedBy === "hover") dismiss();
    }, HOVER_CLOSE_DELAY);
  }

  $effect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node) {
        if (menuEl?.contains(event.target) || trigger?.contains(event.target)) return;
      }
      dismiss();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    const onScroll = (event: Event): void => {
      // 弹层自身可滚动（overflow-auto）时内部滚动不算页面滚动
      if (event.target instanceof Node && menuEl?.contains(event.target)) return;
      if (pinOnClick && openedBy === "pin") return;
      dismiss();
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
  onpointerenter={onTriggerPointerEnter}
  onpointerleave={onTriggerPointerLeave}
>
  {@render children()}
</button>

{#if open}
  <div
    class="popover-glass {menuClass}"
    style={posStyle}
    bind:this={menuEl}
    use:popoverLayer
    role="presentation"
    onpointerenter={onPanelPointerEnter}
    onpointerleave={onPanelPointerLeave}
  >
    {#if scrollClass}
      <div class={scrollClass}>{@render content({ close })}</div>
    {:else}
      {@render content({ close })}
    {/if}
  </div>
{/if}
