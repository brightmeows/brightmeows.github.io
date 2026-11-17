<script lang="ts">
  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import { badgeCountSm } from "#lib/constants/ui-classes.js";

  /** 等级组复合开关：复选框管显隐，标签按钮管跳转。 */
  interface Props {
    checked: boolean;
    label: string;
    count?: number | undefined;
    color?: string | undefined;
    title?: string | undefined;
    disabled?: boolean;
    onToggle: (checked: boolean) => void;
    onJump: () => void;
  }

  let {
    checked,
    label,
    count = undefined,
    color = undefined,
    title = undefined,
    disabled = false,
    onToggle,
    onJump,
  }: Props = $props();
</script>

<div
  class="flex items-center gap-1.5 rounded-full border-2 border-transparent px-2.5 py-1 text-[0.85rem] font-semibold text-white transition-all duration-200 {checked
    ? ''
    : 'opacity-60'}"
  style={color !== undefined ? `background-color:${color};` : undefined}
>
  <Checkbox
    size="sm"
    {checked}
    {disabled}
    ariaLabel={label}
    onchange={(value: boolean) => onToggle(value)}
  />
  <button
    class="cursor-pointer border-0 bg-transparent p-0 text-[0.85rem] font-semibold text-inherit"
    type="button"
    {title}
    {disabled}
    onclick={onJump}
  >
    {label}
  </button>
  {#if count !== undefined}
    <span class={badgeCountSm}>
      {count}
    </span>
  {/if}
</div>
