<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import { page } from "$app/state";
  import LiquidGlassDefs from "$lib/components/ui/LiquidGlassDefs.svelte";
  import { LEGACY_ORIGIN_REDIRECTS, SITE_ORIGIN } from "$lib/constants/site";
  import { theme } from "$lib/data/theme-store.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { getLocale } from "$lib/paraglide/runtime";

  import "./layout.css";

  let { children }: { children: Snippet } = $props();

  // 主题 store 在水合后接管首屏：同步 data-theme、订阅系统偏好并支持手动切换
  onMount(() => theme.init());

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
</svelte:head>

<LiquidGlassDefs />

{@render children()}
