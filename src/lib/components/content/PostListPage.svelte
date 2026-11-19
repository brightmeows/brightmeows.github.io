<script lang="ts">
  import PostCard from "#lib/components/content/PostCard.svelte";
  import PageHero from "#lib/components/layout/PageHero.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { Post } from "#lib/types/post.js";

  interface Props {
    heading: string;
    posts: Post[];
    intro: string;
    meta: string;
  }

  let { heading, posts, intro, meta }: Props = $props();
</script>

<PageShell hero={heroPane} panes={[contentPane]} />

{#snippet heroPane()}
  <PageHero titleText={heading} {intro} {meta}>
    {#snippet title()}{heading}{/snippet}
  </PageHero>
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
