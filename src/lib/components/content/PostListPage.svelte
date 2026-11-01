<script lang="ts">
  import PostCard from "#lib/components/content/PostCard.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { Post } from "#lib/types/post.js";

  interface Props {
    heading: string;
    posts: Post[];
  }

  let { heading, posts }: Props = $props();
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{heading}</h1>
{/snippet}

{#snippet contentPane()}
  {#if posts.length === 0}
    <div class="text-center text-white-70">{m["content.no_posts"]()}</div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each posts as post (post.url)}
        <PostCard {post} />
      {/each}
    </div>
  {/if}
{/snippet}
