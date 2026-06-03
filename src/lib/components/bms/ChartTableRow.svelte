<script lang="ts">
  import BmsLinkButtons from "./BmsLinkButtons.svelte";

  import { jsonPreview } from "$lib/components/JsonPreview.svelte";
  import { GradientButton } from "$lib/components/ui";
  import type { ChartData } from "$lib/types/bms";

  interface BmsLinks {
    bmsScoreViewer: string;
    lr2ir: string;
    mocha: string;
    minir: string;
  }

  interface Props {
    chart: ChartData;
    groupLevel: string;
    groupColor: string;
    bundleUrl: string | undefined;
    diffUrl: string | undefined;
    bmsLinks: BmsLinks;
    chartPreview:
      | {
          show: (
            options: import("$lib/components/JsonPreview.svelte").JsonPreviewShowOptions,
            clientX: number,
            clientY: number
          ) => void | Promise<void>;
          scheduleHide: () => void;
          hideNow: () => void;
        }
      | undefined;
  }

  let { chart, groupLevel, groupColor, bundleUrl, diffUrl, bmsLinks, chartPreview }: Props =
    $props();
</script>

<tr class="hover:bg-white/5">
  <td class="table-td-glass wrap-break-word">
    <span
      class="inline-block min-w-7.5 rounded-xl px-2 py-1 text-center text-[0.85rem] font-semibold text-white"
      style={`background-color:${groupColor};`}
    >
      {groupLevel}
    </span>
  </td>
  <td class="table-td-glass wrap-break-word">
    <div class="flex flex-row flex-wrap gap-[0.3rem]">
      {#if bundleUrl}
        <GradientButton
          variant="green"
          href={bundleUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="min-w-17 flex-1"
        >
          📦 同捆
        </GradientButton>
      {/if}
      {#if diffUrl}
        <GradientButton
          variant="blue"
          href={diffUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="min-w-17 flex-1"
        >
          🔄 差分
        </GradientButton>
      {/if}
    </div>
  </td>
  <td class="table-td-glass wrap-break-word">
    <div class="flex flex-wrap justify-center gap-[0.4rem]">
      <BmsLinkButtons {chart} {bmsLinks} />
    </div>
  </td>
  <td class="table-td-glass wrap-break-word">
    <strong
      class="cursor-default"
      use:jsonPreview={{
        preview: chartPreview,
        options: {
          value: { ...chart, groupLevel },
          label: "谱面 JSON",
          maxHeightRem: 14,
        },
      }}
    >
      {chart.title ?? "未知标题"}
    </strong>
  </td>
  <td class="table-td-glass wrap-break-word">
    {chart.artist ?? "未知艺术家"}
  </td>
  <td class="table-td-glass wrap-break-word">
    {chart.comment ?? ""}
  </td>
</tr>
