<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeClosed from "@lucide/svelte/icons/eye-closed";

  import { badgeCountSm, btnChip, btnChipOnAccent } from "#lib/constants/ui-classes.js";

  /** 编辑态卡片显隐条的一项。 */
  export interface TableCardBarItem {
    id: string;
    label: string;
    visible: boolean;
    anchor: string;
    count?: number | undefined;
  }

  interface Props {
    items: TableCardBarItem[];
    ariaLabel: string;
    onToggle: (id: string, visible: boolean) => void;
  }

  let { items, ariaLabel, onToggle }: Props = $props();

  // 编辑态工作卡显隐：整块按钮切换，不再拆成复选框加跳转两个动作。
  // 横向滚动而不是换行，保持单行高度，避免长表滚动时挤压内容。
</script>

<div
  class="flex flex-nowrap items-center justify-start gap-2 overflow-x-auto sm:justify-center"
  role="group"
  aria-label={ariaLabel}
>
  {#each items as item (item.id)}
    <button
      type="button"
      class="{item.visible ? btnChipOnAccent : btnChip} min-h-9 shrink-0"
      aria-pressed={item.visible}
      aria-controls={item.anchor}
      onclick={() => onToggle(item.id, !item.visible)}
    >
      {#if item.visible}
        <Eye class="size-3.5 shrink-0" aria-hidden="true" />
      {:else}
        <EyeClosed class="size-3.5 shrink-0" aria-hidden="true" />
      {/if}
      {item.label}
      {#if item.count !== undefined}
        <span class={badgeCountSm}>
          {item.count}
        </span>
      {/if}
    </button>
  {/each}
</div>
