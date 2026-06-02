<script lang="ts">
  import { IconButton } from "$lib/components/ui";
  import type { ChartData } from "$lib/types/bms";

  interface BmsLinks {
    bmsScoreViewer: string;
    lr2ir: string;
    mocha: string;
    minir: string;
  }

  interface Props {
    chart: ChartData;
    bmsLinks: BmsLinks;
  }

  let { chart, bmsLinks }: Props = $props();

  function hasMd5(chart: ChartData): boolean {
    const v = chart.md5;
    return typeof v === "string" && v.trim().length > 0;
  }

  function hasSha256(chart: ChartData): boolean {
    const v = chart.sha256;
    return typeof v === "string" && v.trim().length > 0;
  }
</script>

{#if hasMd5(chart)}
  <IconButton
    variant="orange"
    href={bmsLinks.bmsScoreViewer}
    target="_blank"
    rel="noopener noreferrer"
    ariaLabel="BMS Score Viewer"
  >
    📊
  </IconButton>
  <IconButton
    variant="purple"
    href={bmsLinks.lr2ir}
    target="_blank"
    rel="noopener noreferrer"
    ariaLabel="LR2IR"
    class="text-[0.85rem] font-bold"
  >
    LR2
  </IconButton>
{/if}
{#if hasSha256(chart)}
  <IconButton
    variant="brown"
    href={bmsLinks.mocha}
    target="_blank"
    rel="noopener noreferrer"
    ariaLabel="Mocha"
  >
    <img
      src="/assets/logo/mocha_logo.gif"
      alt="Mocha"
      class="h-6 w-6 object-contain"
    />
  </IconButton>
  <IconButton
    variant="cyan"
    href={bmsLinks.minir}
    target="_blank"
    rel="noopener noreferrer"
    ariaLabel="Minir"
  >
    <img
      src="/assets/logo/minir_logo.gif"
      alt="Minir"
      class="h-6 w-6 object-contain"
    />
  </IconButton>
{/if}
