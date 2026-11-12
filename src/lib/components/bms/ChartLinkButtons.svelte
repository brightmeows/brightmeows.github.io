<script lang="ts">
  import type { ChartData } from "@brightmeows/bms/format";
  import { getBmsLinks } from "@brightmeows/bms/table";
  import ArrowRightLeft from "@lucide/svelte/icons/arrow-right-left";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Download from "@lucide/svelte/icons/download";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import Package from "@lucide/svelte/icons/package";
  import { onMount } from "svelte";

  import ClickPopover from "#lib/components/ui/ClickPopover.svelte";
  import { chartLinkIcon, topbarMenuItem } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  interface Props {
    chart: ChartData;
    bundleUrl: string | undefined;
    diffUrl: string | undefined;
  }

  interface LinkItem {
    id: "bundle" | "diff" | "score" | "bms-ir" | "mocha" | "minir";
    href: string;
    label: string;
  }

  let { chart, bundleUrl, diffUrl }: Props = $props();

  const BUTTON_SIZE = 32;
  const GAP = 4;

  let wrapper = $state<HTMLDivElement | undefined>(undefined);
  let availableWidth = $state(0);

  const bmsLinks = $derived(getBmsLinks(chart));
  const hasMd5 = $derived(typeof chart.md5 === "string" && chart.md5.trim().length > 0);
  const hasSha256 = $derived(typeof chart.sha256 === "string" && chart.sha256.trim().length > 0);

  const links = $derived.by<LinkItem[]>(() => {
    const result: LinkItem[] = [];
    if (bundleUrl !== undefined) {
      result.push({ id: "bundle", href: bundleUrl, label: m["common.bundle"]() });
    }
    if (diffUrl !== undefined) {
      result.push({ id: "diff", href: diffUrl, label: m["common.diff"]() });
    }
    if (hasMd5) {
      result.push({ id: "score", href: bmsLinks.bmsScoreViewer, label: "BMS Score Viewer" });
      result.push({ id: "bms-ir", href: bmsLinks.bmsIr, label: "BMS-IR" });
    }
    if (hasSha256) {
      result.push({ id: "mocha", href: bmsLinks.mocha, label: "Mocha" });
      result.push({ id: "minir", href: bmsLinks.minir, label: "Minir" });
    }
    return result;
  });

  const maxSlots = $derived(
    availableWidth <= 0 ? links.length : Math.floor((availableWidth + GAP) / (BUTTON_SIZE + GAP))
  );
  const visibleLinks = $derived.by(() => {
    if (links.length <= maxSlots) return links;
    const slots = Math.max(1, maxSlots);
    return links.slice(0, Math.max(0, slots - 1));
  });
  const hiddenLinks = $derived(links.slice(visibleLinks.length));

  onMount(() => {
    if (wrapper !== undefined) {
      const observer = new ResizeObserver((entries) => {
        availableWidth = entries[0]?.contentRect.width ?? 0;
      });
      observer.observe(wrapper);

      return () => observer.disconnect();
    }
    return undefined;
  });
</script>

{#snippet downloadBadge()}
  <span
    class="pointer-events-none absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full border border-white-20 bg-white-10 text-accent"
    aria-hidden="true"
  >
    <Download class="size-3" strokeWidth={2.5} />
  </span>
{/snippet}

{#snippet icon(link: LinkItem)}
  {#if link.id === "bundle"}
    <span class="relative flex size-5 items-center justify-center">
      <Package class="size-5" aria-hidden="true" />
      {@render downloadBadge()}
    </span>
  {:else if link.id === "diff"}
    <span class="relative flex size-5 items-center justify-center">
      <ArrowRightLeft class="size-5" aria-hidden="true" />
      {@render downloadBadge()}
    </span>
  {:else if link.id === "score"}
    <ChartColumn class="size-5" aria-hidden="true" />
  {:else if link.id === "bms-ir"}
    <svg viewBox="0 0 24 24" class="size-6" aria-hidden="true">
      <text
        x="12"
        y="10.5"
        text-anchor="middle"
        fill="currentColor"
        font-size="9"
        font-family="sans-serif"
        font-weight="700">BMS</text
      >
      <text
        x="12"
        y="19.5"
        text-anchor="middle"
        fill="currentColor"
        font-size="9"
        font-family="sans-serif"
        font-weight="700">-IR</text
      >
    </svg>
  {:else if link.id === "mocha"}
    <img src="/assets/logo/mocha_logo.gif" alt="" class="size-6 object-contain" />
  {:else}
    <img src="/assets/logo/minir_logo.gif" alt="" class="size-6 object-contain" />
  {/if}
{/snippet}

<div class="flex min-w-0 flex-nowrap items-center gap-1" bind:this={wrapper}>
  {#each visibleLinks as link (link.id)}
    <a
      class={chartLinkIcon}
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={link.label}
      title={link.label}
    >
      {@render icon(link)}
    </a>
  {/each}
  {#if hiddenLinks.length > 0}
    <ClickPopover
      label={m["common.more_links"]()}
      triggerClass={chartLinkIcon}
      menuClass="max-h-64 min-w-52 overflow-auto p-1"
      align="left"
      width={208}
      bottomReserve={260}
    >
      <Ellipsis class="size-5" aria-hidden="true" />
      {#snippet content({ close })}
        {#each hiddenLinks as link (link.id)}
          <a
            class={topbarMenuItem}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onclick={close}
          >
            {@render icon(link)}
            <span>{link.label}</span>
          </a>
        {/each}
      {/snippet}
    </ClickPopover>
  {/if}
</div>
