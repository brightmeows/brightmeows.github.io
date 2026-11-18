<script lang="ts">
  import type { PageData } from "./$types";

  import PageHero from "#lib/components/layout/PageHero.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import GlassCard from "#lib/components/ui/GlassCard.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let { data }: { data: PageData } = $props();

  const chapterTotal = $derived(data.books.reduce((sum, book) => sum + book.chapterCount, 0));
</script>

<PageShell hero={heroPane} panes={[contentPane]} />

{#snippet heroPane()}
  <PageHero
    titleText={m["content.category.reading"]()}
    intro={m["content.reading.intro"]()}
    meta={m["content.reading.book_summary"]({
      books: data.books.length,
      chapters: chapterTotal,
    })}
  >
    {#snippet title()}{m["content.category.reading"]()}{/snippet}
  </PageHero>
{/snippet}

{#snippet contentPane()}
  <div class="flex flex-col gap-4">
    {#each data.books as book (book.id)}
      <GlassCard href={book.href} hoverLift>
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
