<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";

  import ClickPopover from "#lib/components/ui/ClickPopover.svelte";
  import { btnIcon } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 行级操作菜单：kebab 触发钮加浮层菜单，定位与关闭由 ClickPopover 原语
   * 承担。拖拽为主的行头把低频操作（上移、下移、删除）收进来，触屏点两步
   * 可达，键盘可聚焦。
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
</script>

<ClickPopover
  {label}
  triggerClass={btnIcon}
  menuClass="min-w-40 p-1"
  align="right"
  width={168}
  bottomReserve={200}
  {disabled}
>
  <EllipsisVertical class="size-4" aria-hidden="true" />
  {#snippet content({ close })}
    {#each items as item (item.label)}
      <button
        class="flex w-full items-center rounded-glass-sm px-2 py-1.5 text-left text-[0.85rem] transition-colors {item.danger
          ? 'text-error hover:bg-error/10'
          : 'text-white-80 hover:bg-white-10 hover:text-white'} disabled:pointer-events-none disabled:opacity-40"
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onclick={() => {
          close();
          item.onselect();
        }}
      >
        {item.label}
      </button>
    {/each}
  {/snippet}
</ClickPopover>
