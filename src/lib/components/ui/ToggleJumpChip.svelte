<script lang="ts">
  import Checkbox from "#lib/components/ui/Checkbox.svelte";

  /** 复合开关：复选框管显隐，标签按钮管跳转；卡片与等级共用。 */
  interface Props {
    checked: boolean;
    label: string;
    count?: number | undefined;
    tone?: "neutral" | "level";
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
    tone = "neutral",
    color = undefined,
    title = undefined,
    disabled = false,
    onToggle,
    onJump,
  }: Props = $props();
</script>

<div
  class="flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-[0.85rem] font-semibold transition-all duration-200 {tone ===
  'level'
    ? 'border-transparent text-white'
    : 'border-white-20 bg-white-10 text-white-85'} {checked ? '' : 'opacity-60'}"
  style={tone === "level" && color !== undefined ? `background-color:${color};` : undefined}
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
    <span class="rounded-glass-sm bg-black-20 px-1.5 py-[0.1rem] text-[0.75rem] opacity-90">
      {count}
    </span>
  {/if}
</div>
