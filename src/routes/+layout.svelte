<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";
  import { LEGACY_ORIGIN_REDIRECTS, SITE_ORIGIN } from "$lib/constants/site";
  import { m } from "$lib/paraglide/messages.js";
  import { getLocale } from "$lib/paraglide/runtime";

  import "./layout.css";

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = getLocale();
    }
  });

  // 平台原域（brightmeows.github.io 等）停留时 API 跨站不带 cookie，
  // 水合后一次性跳到规范子域，保证登录与写操作可用（GitHub 侧已有平台 301，这里兑底）。
  $effect(() => {
    if (typeof location === "undefined") return;
    const target = LEGACY_ORIGIN_REDIRECTS[location.origin];
    if (target !== undefined) {
      location.replace(`${target}${location.pathname}${location.search}${location.hash}`);
    }
  });
</script>

<svelte:head>
  {#if page.data.bmstableMeta}
    <meta name="bmstable" content={page.data.bmstableMeta} />
  {/if}
  <title>{page.data.title ?? m["site.name"]()}</title>
  <link rel="canonical" href={`${SITE_ORIGIN}${page.url.pathname}`} />
  <link rel="icon" href="https://codeberg.org/brightmeows.png" />
</svelte:head>

{@render children()}
