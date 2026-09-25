<script lang="ts">
  import { onMount } from "svelte";

  import type { PageData } from "./$types";

  import { resolve } from "$app/paths";
  import BlogPostCard from "$lib/components/content/BlogPostCard.svelte";
  import { buildTocFromHeadings } from "$lib/components/layout/FloatingToc.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { TocItem } from "$lib/types/ui";

  let { data }: { data: PageData } = $props();
  let tocItems = $state<TocItem[]>([]);

  onMount(() => {
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell {tocItems} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["home.title"]()}</h1>
{/snippet}

{#snippet contentPane()}
  <div class="header-row">
    <h2 class="section-title m-0">{m["nav.blog"]()}</h2>
    <a
      class="text-sm text-accent-light no-underline transition hover:text-accent"
      href={resolve("/blog", {})}
    >
      {m["home.view_all"]()}
    </a>
  </div>

  {#if !data.recentPosts || data.recentPosts.length === 0}
    <div class="text-center text-white/70">{m["blog.no_posts"]()}</div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each data.recentPosts as post (post.slug)}
        <BlogPostCard {post} />
      {/each}
    </div>
  {/if}
{/snippet}
