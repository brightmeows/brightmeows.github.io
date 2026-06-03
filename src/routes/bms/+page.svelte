<script lang="ts">
  import { onMount, tick } from "svelte";

  import { resolve } from "$app/paths";
  import BmsContent from "$content/bms/index.md";
  import { buildTocFromHeadings, type TocItem } from "$lib/components/FloatingToc.svelte";
  import MarkdownContent from "$lib/components/MarkdownContent.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import { GlassCard } from "$lib/components/ui";

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
    <GlassCard href={resolve("/bms/table/mirror", {})} class="flex w-80 flex-col">
      <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">难度表镜像</div>
      <div class="text-[0.95rem] text-white/80">BMS 难度表镜像列表（支持多语言搜索）</div>
    </GlassCard>
    <GlassCard href={resolve("/bms/table/self-sp", {})} class="flex w-80 flex-col">
      <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">谱面合集（SP）</div>
      <div class="text-[0.95rem] text-white/80">个人 SP 难度表</div>
    </GlassCard>
    <GlassCard href={resolve("/bms/table/self-dp", {})} class="flex w-80 flex-col">
      <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">谱面合集（DP）</div>
      <div class="text-[0.95rem] text-white/80">个人 DP 难度表</div>
    </GlassCard>
  </div>
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    <BmsContent />
  </MarkdownContent>
{/snippet}
