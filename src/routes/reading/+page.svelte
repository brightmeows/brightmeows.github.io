<script lang="ts">
  import type { PageData } from "./$types";

  import PageShell from "#lib/components/layout/PageShell.svelte";
  import GlassCard from "#lib/components/ui/GlassCard.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let { data }: { data: PageData } = $props();
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["content.category.reading"]()}</h1>
{/snippet}

{#snippet contentPane()}
  <div class="flex flex-col gap-4">
    {#each data.books as book (book.id)}
      <GlassCard href={book.href}>
        <div class="mb-1 flex flex-wrap items-baseline justify-between gap-3">
          <div class="accent-title">{book.title}</div>
          <div class="text-[0.85rem] text-white-60">
            {m["content.reading.chapter_count"]({ count: book.chapterCount })}
          </div>
        </div>
        <div class="text-[0.95rem] text-white-80">{book.description}</div>
      </GlassCard>
    {/each}
  </div>
{/snippet}
