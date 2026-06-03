<script lang="ts">
  import BlogPostCard from "$lib/components/BlogPostCard.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import type { BlogPost } from "$lib/types/blog";

  let { data }: { data: { posts: BlogPost[] } } = $props();
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">博客文章</h1>
{/snippet}

{#snippet contentPane()}
  {#if data.posts.length === 0}
    <div class="text-center text-white/70">暂无文章</div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each data.posts as post (post.slug)}
        <BlogPostCard {post} />
      {/each}
    </div>
  {/if}
{/snippet}
