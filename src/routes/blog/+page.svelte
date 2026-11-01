<script lang="ts">
  import PostCard from "#lib/components/content/PostCard.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { Post } from "#lib/types/post.js";

  let { data }: { data: { posts: Post[] } } = $props();
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["blog.page_title"]()}</h1>
{/snippet}

{#snippet contentPane()}
  {#if data.posts.length === 0}
    <div class="text-center text-white-70">{m["blog.no_posts"]()}</div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each data.posts as post (post.slug)}
        <PostCard {post} />
      {/each}
    </div>
  {/if}
{/snippet}
