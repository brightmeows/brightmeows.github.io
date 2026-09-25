<script lang="ts">
  import BmsLinkButtons from "./BmsLinkButtons.svelte";

  import GradientButton from "$lib/components/ui/GradientButton.svelte";
  import { jsonPreview } from "$lib/components/ui/JsonPreview.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { ChartData } from "$lib/types/bms";
  import type { JsonPreviewHandle } from "$lib/types/ui";

  interface Props {
    chart: ChartData;
    groupLevel: string;
    groupColor: string;
    bundleUrl: string | undefined;
    diffUrl: string | undefined;
    chartPreview: JsonPreviewHandle | undefined;
    symbol?: string;
  }

  let {
    chart,
    groupLevel,
    groupColor,
    bundleUrl,
    diffUrl,
    chartPreview,
    symbol = "",
  }: Props = $props();
</script>

<tr class="hover:bg-white/5">
  <td class="table-td-glass whitespace-nowrap">
    <span
      class="inline-block min-w-7.5 rounded-xl px-2 py-1 text-center text-[0.85rem] font-semibold text-white"
      style={`background-color:${groupColor};`}
    >
      {symbol}{groupLevel}
    </span>
  </td>
  <td class="table-td-glass whitespace-nowrap">
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
  <td class="table-td-glass whitespace-nowrap">
    <div class="flex flex-nowrap justify-center gap-[0.4rem]">
      <BmsLinkButtons {chart} />
    </div>
  </td>
  <td class="table-td-glass wrap-break-word">
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
  </td>
  <td class="table-td-glass wrap-break-word">
    {chart.artist ?? m["common.unknown_artist"]()}
  </td>
  <td class="table-td-glass wrap-break-word">
    {chart.comment ?? ""}
  </td>
</tr>
