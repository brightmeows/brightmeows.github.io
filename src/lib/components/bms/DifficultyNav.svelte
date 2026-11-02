<script lang="ts">
  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import { m } from "#lib/paraglide/messages.js";

  export interface DifficultyNavItem {
    level: string;
    unassigned: boolean;
    count: number;
    color: string;
  }

  /** 条目面板的难度导航：查看态跳转，编辑态勾选筛选并跳转。 */
  interface Props {
    items: DifficultyNavItem[];
    editing: boolean;
    symbol: string;
    selectedLevels: ReadonlySet<string>;
    includeUnassigned: boolean;
    onToggleLevel: (level: string, checked: boolean) => void;
    onToggleUnassigned: (checked: boolean) => void;
    onJump: (item: DifficultyNavItem) => void;
  }

  let {
    items,
    editing,
    symbol,
    selectedLevels,
    includeUnassigned,
    onToggleLevel,
    onToggleUnassigned,
    onJump,
  }: Props = $props();

  function label(item: DifficultyNavItem): string {
    return item.unassigned ? m["editor.entries_filter_unassigned"]() : `${symbol}${item.level}`;
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each items as item (item.unassigned ? "__unassigned__" : item.level)}
    {#if editing}
      <div
        class="flex items-center gap-1.5 rounded-full px-2 py-1 text-white"
        style={`background-color:${item.color};`}
      >
        <Checkbox
          size="sm"
          checked={item.unassigned ? includeUnassigned : selectedLevels.has(item.level)}
          ariaLabel={label(item)}
          onchange={(checked: boolean) =>
            item.unassigned ? onToggleUnassigned(checked) : onToggleLevel(item.level, checked)}
        />
        <button
          class="cursor-pointer border-0 bg-transparent p-0 text-[0.9rem] font-semibold text-white"
          type="button"
          onclick={() => onJump(item)}
        >
          {label(item)}
        </button>
        <span class="rounded-[10px] bg-black-20 px-1.5 py-[0.1rem] text-[0.8rem] opacity-90">
          {item.count}
        </span>
      </div>
    {:else}
      <button
        class="flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-transparent px-3 py-1.5 text-[0.9rem] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:brightness-110"
        type="button"
        style={`background-color:${item.color};`}
        onclick={() => onJump(item)}
      >
        {label(item)}
        <span class="rounded-[10px] bg-black-20 px-1.5 py-[0.1rem] text-[0.8rem] opacity-90">
          {item.count}
        </span>
      </button>
    {/if}
  {/each}
</div>
