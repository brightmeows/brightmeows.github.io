<script lang="ts">
  import type { ChartData } from "@brightmeows/bms/format";
  import { getBmsLinks } from "@brightmeows/bms/table";
  import ChartColumn from "@lucide/svelte/icons/chart-column";

  import IconButton from "#lib/components/ui/IconButton.svelte";

  interface Props {
    chart: ChartData;
  }

  let { chart }: Props = $props();
  const bmsLinks = $derived(getBmsLinks(chart));

  function hasMd5(data: ChartData): boolean {
    const v = data.md5;
    return typeof v === "string" && v.trim().length > 0;
  }

  function hasSha256(data: ChartData): boolean {
    const v = data.sha256;
    return typeof v === "string" && v.trim().length > 0;
  }
</script>

{#if hasMd5(chart)}
  <IconButton
    skin="gradient-orange"
    href={bmsLinks.bmsScoreViewer}
    external
    ariaLabel="BMS Score Viewer"
  >
    <ChartColumn class="size-5" aria-hidden="true" />
  </IconButton>
  <IconButton skin="gradient-blue" href={bmsLinks.bmsIr} external ariaLabel="BMS-IR">
    <svg viewBox="0 0 24 24" class="h-8 w-8">
      <text
        x="12"
        y="11"
        text-anchor="middle"
        fill="white"
        font-size="10"
        font-family="sans-serif"
        font-weight="700">BMS</text
      >
      <text
        x="12"
        y="20.5"
        text-anchor="middle"
        fill="white"
        font-size="10"
        font-family="sans-serif"
        font-weight="700">-IR</text
      >
    </svg>
  </IconButton>
{/if}
{#if hasSha256(chart)}
  <IconButton skin="gradient-brown" href={bmsLinks.mocha} external ariaLabel="Mocha">
    <img src="/assets/logo/mocha_logo.gif" alt="Mocha" class="h-6 w-6 object-contain" />
  </IconButton>
  <IconButton skin="gradient-cyan" href={bmsLinks.minir} external ariaLabel="Minir">
    <img src="/assets/logo/minir_logo.gif" alt="Minir" class="h-6 w-6 object-contain" />
  </IconButton>
{/if}
