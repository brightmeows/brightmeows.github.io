<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import { SITE_ORIGIN } from "#lib/constants/site.js";
  import { theme } from "#lib/data/store/theme-store.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { page } from "$app/state";

  import "./layout.css";

  let { children }: { children: Snippet } = $props();

  // 主题 store 在水合后接管首屏：同步 data-theme、订阅系统偏好并支持手动切换
  onMount(() => theme.init());

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
  <title>{page.data.title ?? m["site.name"]()}</title>
  <link rel="canonical" href={`${SITE_ORIGIN}${page.url.pathname}`} />
</svelte:head>

{@render children()}
