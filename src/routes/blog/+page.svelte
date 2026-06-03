<script lang="ts">
  import BlogPostCard from "$lib/components/BlogPostCard.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import { GlassContainer } from "$lib/components/ui";
  import type { BlogPost } from "$lib/types/blog";

  let { data }: { data: { posts: BlogPost[] } } = $props();
</script>

<PageShell>
  <GlassContainer animate={true} class="mt-8 w-full">
    <h1 class="page-title mb-8 text-center">博客文章</h1>

    {#if data.posts.length === 0}
      <div class="text-center text-white/70">暂无文章</div>
    {:else}
      <div class="flex flex-col gap-4">
        {#each data.posts as post (post.slug)}
          <BlogPostCard {post} />
        {/each}
      </div>
    {/if}
  </GlassContainer>
</PageShell>
