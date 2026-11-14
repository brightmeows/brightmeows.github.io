<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import { SITE_ORIGIN } from "#lib/constants/site.js";
  import { theme } from "#lib/data/store/theme-store.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { page } from "$app/state";

  import "./layout.css";

  let { children }: { children: Snippet } = $props();

  // 页面元信息：内容页取 frontmatter 的 description，列表与工具页回落站点简介。
  const pageTitle = $derived(page.data.title ?? m["site.name"]());
  const description = $derived(
    typeof page.data.description === "string" && page.data.description.trim() !== ""
      ? page.data.description
      : m["site.description"]()
  );
  // canonical 与 og:url 同源（规范域恒为 SITE_ORIGIN，路径带尾斜杠）。
  const canonicalUrl = $derived(`${SITE_ORIGIN}${page.url.pathname}`);

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
  <title>{pageTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:type" content={page.data.post === undefined ? "website" : "article"} />
  <meta property="og:site_name" content={m["site.name"]()} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={`${SITE_ORIGIN}/assets/avatar.png`} />
  <meta name="twitter:card" content="summary" />
</svelte:head>

{@render children()}
