<script lang="ts">
  import BlogPostCard from "$lib/components/content/BlogPostCard.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { BlogPost } from "$lib/types/blog";

  let { data }: { data: { posts: BlogPost[] } } = $props();
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["blog.page_title"]()}</h1>
{/snippet}

{#snippet contentPane()}
  {#if data.posts.length === 0}
    <div class="text-center text-white/70">{m["blog.no_posts"]()}</div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each data.posts as post (post.slug)}
        <BlogPostCard {post} />
      {/each}
    </div>
  {/if}
{/snippet}
