<script lang="ts">
  import type { PageData } from "./$types";

  import FloatingToc from "$lib/components/FloatingToc.svelte";
  import MarkdownContent from "$lib/components/MarkdownContent.svelte";
  import PageShell from "$lib/components/PageShell.svelte";

  let { data }: { data: PageData } = $props();
</script>

<PageShell currentLabel={data.post.title ?? "文章"}>
  <article class="animate-fadeIn mt-8 rounded-[20px] border border-white/10 bg-white/10 p-8">
    <h1 class="page-title mb-4">{data.post.title}</h1>
    {#if data.post.date}
      <div class="mb-8 text-white/60">{data.post.date}</div>
    {/if}

    <MarkdownContent>
      {@const Content = data.component}
      {#if Content}
        <!-- svelte-ignore svelte_component_deprecated -->
        <svelte:component this={Content} />
      {/if}
    </MarkdownContent>
  </article>
</PageShell>

<FloatingToc />
