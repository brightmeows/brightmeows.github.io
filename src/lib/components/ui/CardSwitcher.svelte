<script lang="ts">
  import ToggleJumpChip from "./ToggleJumpChip.svelte";

  /** 卡片显隐与跳转行：详情页和镜像列表共用。 */
  export interface CardSwitchItem {
    id: string;
    label: string;
    checked: boolean;
    count?: number | undefined;
    title?: string | undefined;
    disabled?: boolean;
  }

  interface Props {
    items: CardSwitchItem[];
    ariaLabel: string;
    align?: "start" | "center";
    onToggle: (id: string, checked: boolean) => void;
    onJump: (id: string) => void;
  }

  let { items, ariaLabel, align = "start", onToggle, onJump }: Props = $props();
</script>

<div
  class="flex flex-wrap items-center gap-2 {align === 'center' ? 'justify-center' : ''}"
  role="group"
  aria-label={ariaLabel}
>
  {#each items as item (item.id)}
    <ToggleJumpChip
      checked={item.checked}
      label={item.label}
      count={item.count}
      title={item.title}
      disabled={item.disabled ?? false}
      onToggle={(checked: boolean) => onToggle(item.id, checked)}
      onJump={() => onJump(item.id)}
    />
  {/each}
</div>
