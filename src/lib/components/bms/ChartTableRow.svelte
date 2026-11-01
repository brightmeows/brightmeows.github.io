<script lang="ts">
  import type { ChartData } from "@brightmeows/bms/format";

  import BmsLinkButtons from "./BmsLinkButtons.svelte";

  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import GradientButton from "#lib/components/ui/GradientButton.svelte";
  import { jsonPreview } from "#lib/components/ui/JsonPreview.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { JsonPreviewHandle } from "#lib/types/ui.js";

  interface Props {
    chart: ChartData;
    groupLevel: string;
    groupColor: string;
    bundleUrl: string | undefined;
    diffUrl: string | undefined;
    chartPreview: JsonPreviewHandle | undefined;
    symbol?: string;
    /** 编辑态：在行首显示勾选框。 */
    selectable?: boolean;
    selected?: boolean;
    disabled?: boolean;
    onSelect?: ((checked: boolean) => void) | undefined;
    /** 编辑态：标题列内的编辑入口。 */
    onEdit?: (() => void) | undefined;
    /** 编辑态：未指派条目的文件等级建议。 */
    levelHint?: string | null;
  }

  let {
    chart,
    groupLevel,
    groupColor,
    bundleUrl,
    diffUrl,
    chartPreview,
    symbol = "",
    selectable = false,
    selected = false,
    disabled = false,
    onSelect,
    onEdit,
    levelHint = null,
  }: Props = $props();
</script>

<tr class="hover:bg-white-5">
  {#if selectable}
    <td class="table-td-compact px-2">
      <Checkbox
        size="sm"
        checked={selected}
        {disabled}
        ariaLabel={m["editor.entries_select_row"]()}
        onchange={(checked: boolean) => onSelect?.(checked)}
      />
    </td>
  {/if}
  <td class="table-td-compact whitespace-nowrap">
    <span
      class="inline-block min-w-7.5 rounded-xl px-2 py-1 text-center text-[0.85rem] font-semibold text-white"
      style={`background-color:${groupColor};`}
    >
      {symbol}{groupLevel}
    </span>
    {#if levelHint}
      <div class="mt-1 text-[0.75rem] text-white-40">{levelHint}</div>
    {/if}
  </td>
  <td class="table-td-compact whitespace-nowrap">
    <div class="flex flex-row flex-nowrap justify-center gap-[0.3rem]">
      {#if bundleUrl}
        <GradientButton variant="green" href={bundleUrl} target="_blank" rel="noopener noreferrer">
          📦 {m["common.bundle"]()}
        </GradientButton>
      {/if}
      {#if diffUrl}
        <GradientButton variant="blue" href={diffUrl} target="_blank" rel="noopener noreferrer">
          🔄 {m["common.diff"]()}
        </GradientButton>
      {/if}
    </div>
  </td>
  <td class="table-td-compact whitespace-nowrap">
    <div class="flex flex-nowrap justify-center gap-[0.4rem]">
      <BmsLinkButtons {chart} />
    </div>
  </td>
  <td class="table-td-compact wrap-break-word">
    <strong
      class="cursor-default"
      use:jsonPreview={{
        preview: chartPreview,
        options: {
          value: { ...chart, groupLevel },
          label: m["common.chart_json"](),
          maxHeightRem: 14,
        },
      }}
    >
      {chart.title ?? m["common.unknown_title"]()}
    </strong>
    {#if onEdit}
      <button
        class="link-accent ml-2 text-[0.8rem] whitespace-nowrap"
        type="button"
        title={m["editor.entry_edit"]()}
        aria-label={m["editor.entry_edit_title"]()}
        onclick={onEdit}
      >
        {m["editor.entry_edit_short"]()}
      </button>
    {/if}
  </td>
  <td class="table-td-compact wrap-break-word">
    {chart.artist ?? m["common.unknown_artist"]()}
  </td>
  <td class="table-td-compact wrap-break-word">
    {chart.comment ?? ""}
  </td>
</tr>
