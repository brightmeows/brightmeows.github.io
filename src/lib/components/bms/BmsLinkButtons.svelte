<script lang="ts">
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import type { ChartData } from "$lib/types/bms";
  import { getBmsLinks } from "$lib/utils/bms-table";

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
    variant="orange"
    href={bmsLinks.bmsScoreViewer}
    target="_blank"
    rel="noopener noreferrer"
    ariaLabel="BMS Score Viewer"
  >
    📊
  </IconButton>
  <IconButton
    variant="blue"
    href={bmsLinks.bmsIr}
    target="_blank"
    rel="noopener noreferrer"
    ariaLabel="BMS-IR"
  >
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
  <IconButton
    variant="brown"
    href={bmsLinks.mocha}
    target="_blank"
    rel="noopener noreferrer"
    ariaLabel="Mocha"
  >
    <img src="/assets/logo/mocha_logo.gif" alt="Mocha" class="h-6 w-6 object-contain" />
  </IconButton>
  <IconButton
    variant="cyan"
    href={bmsLinks.minir}
    target="_blank"
    rel="noopener noreferrer"
    ariaLabel="Minir"
  >
    <img src="/assets/logo/minir_logo.gif" alt="Minir" class="h-6 w-6 object-contain" />
  </IconButton>
{/if}
