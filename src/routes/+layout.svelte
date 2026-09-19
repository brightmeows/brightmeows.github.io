<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";
  import { SITE_ORIGIN } from "$lib/constants/site";
  import { getLocale } from "$lib/paraglide/runtime";

  import "./layout.css";

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = getLocale();
    }
  });
</script>

<svelte:head>
  {#if page.data.bmstableMeta}
    <meta name="bmstable" content={page.data.bmstableMeta} />
  {/if}
  <title>{page.data.title ?? "白喵斯的小屋"}</title>
  <link rel="canonical" href={`${SITE_ORIGIN}${page.url.pathname}`} />
  <link rel="icon" href="https://codeberg.org/brightmeows.png" />
</svelte:head>

{@render children()}
