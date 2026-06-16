<script lang="ts">
  import { onMount } from "svelte";

  import type { PageData } from "./$types";

  import { resolve } from "$app/paths";
  import BlogPostCard from "$lib/components/content/BlogPostCard.svelte";
  import { PageShell } from "$lib/components/layout";
  import { buildTocFromHeadings } from "$lib/components/layout/FloatingToc.svelte";
  import type { TocItem } from "$lib/types/ui";

  let { data }: { data: PageData } = $props();
  let tocItems = $state<TocItem[]>([]);

  onMount(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell
  {tocItems}
  navChildren={data.navChildren}
  navShortcuts={data.navShortcuts}
  panes={[titlePane, contentPane]}
/>

{#snippet titlePane()}
  <h1 class="page-title text-center">欢迎来到白喵斯的小屋！</h1>
{/snippet}

{#snippet contentPane()}
  <div class="mb-6 flex flex-wrap items-baseline justify-between gap-3">
    <h2 class="section-title m-0">博客</h2>
    <a
      class="text-sm text-sky-300 no-underline transition hover:text-sky-200"
      href={resolve("/blog", {})}
    >
      查看全部 →
    </a>
  </div>

  {#if !data.recentPosts || data.recentPosts.length === 0}
    <div class="text-center text-white/70">暂无文章</div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each data.recentPosts as post (post.slug)}
        <BlogPostCard {post} />
      {/each}
    </div>
  {/if}
{/snippet}
