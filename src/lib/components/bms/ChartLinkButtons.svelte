<script lang="ts">
  import type { ChartData } from "@brightmeows/bms/format";
  import { getBmsLinks } from "@brightmeows/bms/table";
  import { onMount } from "svelte";

  import { chartLinkIcon } from "#lib/constants/ui-classes.js";
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
  let menuButton = $state<HTMLButtonElement | undefined>(undefined);
  let menuEl = $state<HTMLDivElement | undefined>(undefined);
  let availableWidth = $state(0);
  let menuOpen = $state(false);
  let menuStyle = $state("");

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

  function closeMenu(): void {
    menuOpen = false;
  }

  function toggleMenu(): void {
    if (menuOpen) {
      closeMenu();
      return;
    }
    if (menuButton === undefined) return;
    const rect = menuButton.getBoundingClientRect();
    const width = 208;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 6, window.innerHeight - 260);
    menuStyle = `inset:auto;left:${left}px;top:${Math.max(8, top)}px;background-color:#17142b;`;
    menuOpen = true;
  }

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

  $effect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node) {
        if (menuEl?.contains(event.target) || menuButton?.contains(event.target)) return;
      }
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeMenu();
    };
    const onScroll = (): void => closeMenu();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  });

  $effect(() => {
    if (menuEl === undefined) return;
    if (menuOpen && !menuEl.matches(":popover-open")) {
      menuEl.showPopover();
    } else if (!menuOpen && menuEl.matches(":popover-open")) {
      menuEl.hidePopover();
    }
  });
</script>

{#snippet downloadBadge()}
  <span
    class="pointer-events-none absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full border border-white-20 bg-white-10 text-accent"
    aria-hidden="true"
  >
    <svg
      class="size-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 4v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M6 21h12" />
    </svg>
  </span>
{/snippet}

{#snippet icon(link: LinkItem)}
  {#if link.id === "bundle"}
    <span class="relative flex size-5 items-center justify-center">
      <svg
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m21 8-9-5-9 5 9 5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </svg>
      {@render downloadBadge()}
    </span>
  {:else if link.id === "diff"}
    <span class="relative flex size-5 items-center justify-center">
      <svg
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m8 3-4 4 4 4" />
        <path d="M4 7h16" />
        <path d="m16 21 4-4-4-4" />
        <path d="M20 17H4" />
      </svg>
      {@render downloadBadge()}
    </span>
  {:else if link.id === "score"}
    <svg
      class="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M22 20H2" />
    </svg>
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
    <button
      class={chartLinkIcon}
      type="button"
      bind:this={menuButton}
      aria-label={m["common.more_links"]()}
      aria-expanded={menuOpen}
      title={m["common.more_links"]()}
      onclick={toggleMenu}
    >
      <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
  {/if}
</div>

{#if hiddenLinks.length > 0}
  <div
    class="fixed z-2000 max-h-64 min-w-52 overflow-auto rounded-lg border border-white-20 bg-[#17142b] p-1 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
    style={menuStyle}
    bind:this={menuEl}
    role="menu"
    popover="manual"
  >
    {#each hiddenLinks as link (link.id)}
      <a
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.85rem] text-white-80 transition-colors hover:bg-white-10 hover:text-white"
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        onclick={closeMenu}
      >
        {@render icon(link)}
        <span>{link.label}</span>
      </a>
    {/each}
  </div>
{/if}
