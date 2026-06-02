<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";
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
  <title>{page.data.title ?? "白喵斯的小屋"}</title>
  <link rel="icon" href="https://codeberg.org/brightmeows.png" />
  {#if page.data.bmstableMeta}
    <meta name="bmstable" content={page.data.bmstableMeta} />
  {/if}
</svelte:head>

{@render children()}
