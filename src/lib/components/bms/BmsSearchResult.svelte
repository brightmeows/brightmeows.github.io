<script lang="ts">
  import BmsLinkButtons from "./BmsLinkButtons.svelte";

  import { GlassContainer } from "$lib/components/ui";
  import type { SearchResult } from "$lib/data/bms-search";
  import type { ChartData } from "$lib/types/bms";
  import { getBmsLinks } from "$lib/utils/bms-table";

  interface Props {
    result: SearchResult;
  }

  let { result }: Props = $props();

  /** 构造最小 ChartData 以复用 BmsLinkButtons */
  const chartLike = $derived<ChartData>({
    md5: result.md5,
    sha256: result.sha256,
    title: result.title,
    artist: result.artist,
  });

  const bmsLinks = $derived(getBmsLinks(chartLike));

  const tableLinks = $derived(
    result.appearances.map((a) => ({
      ...a,
      href: `/bms/table/mirror/${a.tableId}`,
    }))
  );
</script>

<GlassContainer padding="lg" rounded="lg" class="mb-6">
  <!-- 谱面基本信息 -->
  <div class="mb-4">
    <h3 class="mb-1 text-[1.2rem] font-bold text-white">{result.title || "(无标题)"}</h3>
    <p class="text-white/70">{result.artist || "(未知艺术家)"}</p>
  </div>

  <!-- 外部链接（复用已有组件） -->
  <div class="mb-4 flex flex-wrap gap-2">
    <BmsLinkButtons chart={chartLike} {bmsLinks} />
  </div>

  <!-- 跨表信息 -->
  <div class="space-y-3">
    <h4 class="text-[1rem] font-semibold text-[#64b5f6]">
      出现在 {result.appearances.length} 个难度表中
    </h4>
    {#each tableLinks as entry (entry.tableId + entry.level)}
      <div class="flex items-center gap-3 rounded-[10px] bg-black/20 px-4 py-2">
        <span
          class="inline-block rounded-[8px] bg-[#4caf50]/20 px-3 py-1 text-[0.9rem] font-bold text-[#4caf50]"
        >
          {entry.level}
        </span>
        <a class="text-white no-underline transition-colors hover:text-[#64b5f6]" href={entry.href}>
          {entry.tableName}
        </a>
        {#if entry.comment}
          <span class="text-[0.85rem] text-white/50">— {entry.comment}</span>
        {/if}
      </div>
    {/each}
  </div>
</GlassContainer>
