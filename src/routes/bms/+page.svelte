<script lang="ts">
  import { onMount, tick } from "svelte";

  import { resolve } from "$app/paths";
  import BmsContent from "$content/bms/index.md";
  import { buildTocFromHeadings, type TocItem } from "$lib/components/FloatingToc.svelte";
  import MarkdownContent from "$lib/components/MarkdownContent.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import { GlassNavCard } from "$lib/components/ui";

  let tocItems: TocItem[] = [];

  onMount(async () => {
    await tick();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell {tocItems} panes={[titlePane, navPane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS</h1>
{/snippet}

{#snippet navPane()}
  <div class="flex flex-wrap items-stretch justify-center gap-4">
    <GlassNavCard
      href={resolve("/bms/table/mirror", {})}
      title="难度表镜像"
      description="BMS 难度表镜像列表（支持多语言搜索）"
    />
    <GlassNavCard
      href={resolve("/bms/table/self-sp", {})}
      title="谱面合集（SP）"
      description="个人 SP 难度表"
    />
    <GlassNavCard
      href={resolve("/bms/table/self-dp", {})}
      title="谱面合集（DP）"
      description="个人 DP 难度表"
    />
  </div>
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    <BmsContent />
  </MarkdownContent>
{/snippet}
