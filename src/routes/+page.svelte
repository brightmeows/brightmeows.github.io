<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import { onMount } from "svelte";

  import type { PageData } from "./$types";

  import PostCard from "#lib/components/content/PostCard.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import { btnGhostXs } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem } from "#lib/types/ui.js";
  import { buildTocFromHeadings } from "#lib/utils/ui/toc.js";
  import { resolve } from "$app/paths";

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
    <h2 class="section-title m-0">{data.sectionTitle}</h2>
    <a class={btnGhostXs} href={resolve("/blog")}>
      {m["home.view_all"]()}
      <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
    </a>
  </div>

  {#if !data.recentPosts || data.recentPosts.length === 0}
    <div class="text-center text-white-70">{m["content.no_posts"]()}</div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each data.recentPosts as post (post.slug)}
        <PostCard {post} />
      {/each}
    </div>
  {/if}
{/snippet}
