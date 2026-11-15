<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Layers from "@lucide/svelte/icons/layers";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import Library from "@lucide/svelte/icons/library";
  import NotebookPen from "@lucide/svelte/icons/notebook-pen";
  import Search from "@lucide/svelte/icons/search";
  import Table2 from "@lucide/svelte/icons/table-2";
  import { onMount } from "svelte";

  import type { PageData } from "./$types";

  import PostCard from "#lib/components/content/PostCard.svelte";
  import PageHero from "#lib/components/layout/PageHero.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import { btnGhostMd, btnGhostXs } from "#lib/constants/ui-classes.js";
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

<PageShell {tocItems} hero={heroPane} panes={[contentPane]} />

{#snippet heroPane()}
  <PageHero titleText={m["home.title"]()}>
    {#snippet title()}{m["home.title"]()}{/snippet}
    {#snippet promo()}
      <div class="flex flex-col items-center gap-4">
        <p class="m-0 max-w-[42rem] text-center text-[1.05rem] leading-relaxed text-white-70">
          {m["site.description"]()}
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <a class={btnGhostMd} href={resolve("/bms")}>
            <LayoutGrid class="size-4 shrink-0" aria-hidden="true" />
            {m["nav.overview"]()}
          </a>
          <a class={btnGhostMd} href={resolve("/bms/table")}>
            <Table2 class="size-4 shrink-0" aria-hidden="true" />
            {m["nav.table"]()}
          </a>
          <a class={btnGhostMd} href={resolve("/bms/table/mirror")}>
            <Layers class="size-4 shrink-0" aria-hidden="true" />
            {m["nav.mirror"]()}
          </a>
          <a class={btnGhostMd} href={resolve("/bms/table/search")}>
            <Search class="size-4 shrink-0" aria-hidden="true" />
            {m["nav.search"]()}
          </a>
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          <a class={btnGhostMd} href={resolve("/blog")}>
            <BookOpen class="size-4 shrink-0" aria-hidden="true" />
            {m["content.category.blog"]()}
          </a>
          <a class={btnGhostMd} href={resolve("/notes")}>
            <NotebookPen class="size-4 shrink-0" aria-hidden="true" />
            {m["content.category.notes"]()}
          </a>
          <a class={btnGhostMd} href={resolve("/reading")}>
            <Library class="size-4 shrink-0" aria-hidden="true" />
            {m["content.category.reading"]()}
          </a>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.85rem]">
          <a
            class="text-white-50 no-underline transition-colors hover:text-white"
            href="https://codeberg.org/brightmeows"
            target="_blank"
            rel="noopener noreferrer">Codeberg</a
          >
          <a
            class="text-white-50 no-underline transition-colors hover:text-white"
            href="https://space.bilibili.com/215242890"
            target="_blank"
            rel="noopener noreferrer">Bilibili</a
          >
          <a
            class="text-white-50 no-underline transition-colors hover:text-white"
            href="https://x.com/MiyakoWoW"
            target="_blank"
            rel="noopener noreferrer">X (Twitter)</a
          >
        </div>
      </div>
    {/snippet}
  </PageHero>
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
