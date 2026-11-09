<script lang="ts">
  import { btnIcon } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 行级操作菜单：kebab 按钮加 popover-glass 弹层，借条目链接列溢出菜单的
   * 定位与关闭机制。拖拽为主的行头把低频操作（上移、下移、删除）收进来，
   * 触屏点两步可达，键盘可聚焦。
   */

  /** 菜单项：选中回调与禁用态；danger 项按语义错误色渲染。 */
  export interface RowActionItem {
    label: string;
    danger?: boolean;
    disabled?: boolean;
    onselect: () => void;
  }

  interface Props {
    items: RowActionItem[];
    disabled?: boolean;
    /** 无障碍名；缺省为通用“更多操作”。 */
    label?: string;
  }

  let { items, disabled = false, label = m["common.more_actions"]() }: Props = $props();

  let menuButton = $state<HTMLButtonElement | undefined>(undefined);
  let menuEl = $state<HTMLDivElement | undefined>(undefined);
  let menuOpen = $state(false);
  let menuStyle = $state("");

  function toggleMenu(): void {
    if (menuOpen) {
      menuOpen = false;
      return;
    }
    if (menuButton === undefined) return;
    const rect = menuButton.getBoundingClientRect();
    const width = 168;
    // 行尾 kebab：弹层右缘对齐按钮右缘，越界时收进视口
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 6, window.innerHeight - 200);
    menuStyle = `inset:auto;left:${left}px;top:${Math.max(8, top)}px;`;
    menuOpen = true;
  }

  function closeMenu(): void {
    menuOpen = false;
  }

  function select(item: RowActionItem): void {
    closeMenu();
    item.onselect();
  }

  $effect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node) {
        if (menuEl?.contains(event.target) || menuButton?.contains(event.target)) return;
      }
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeMenu();
    };
    const onScroll = (): void => closeMenu();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  });

  $effect(() => {
    if (menuEl === undefined) return;
    if (menuOpen && !menuEl.matches(":popover-open")) {
      menuEl.showPopover();
    } else if (!menuOpen && menuEl.matches(":popover-open")) {
      menuEl.hidePopover();
    }
  });
</script>

<button
  class={btnIcon}
  type="button"
  bind:this={menuButton}
  aria-label={label}
  aria-expanded={menuOpen}
  title={label}
  {disabled}
  onclick={toggleMenu}
>
  <svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
  </svg>
</button>

{#if menuOpen}
  <div
    class="popover-glass min-w-40 p-1"
    style={menuStyle}
    bind:this={menuEl}
    role="menu"
    popover="manual"
  >
    {#each items as item (item.label)}
      <button
        class="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[0.85rem] transition-colors {item.danger
          ? 'text-error hover:bg-error/10'
          : 'text-white-80 hover:bg-white-10 hover:text-white'} disabled:pointer-events-none disabled:opacity-40"
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onclick={() => select(item)}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}
