<script lang="ts">
  import BmsLinkButtons from "./BmsLinkButtons.svelte";

  import { GlassContainer, GradientButton } from "$lib/components/ui";
  import type { SearchResult } from "$lib/data/bms-search";
  import type { ChartData } from "$lib/types/bms";
  import { getBmsLinks } from "$lib/utils/bms-table";

  interface Props {
    result: SearchResult;
  }

  let { result }: Props = $props();

  const chartLike = $derived<ChartData>({
    md5: result.md5,
    sha256: result.sha256,
    title: result.title,
    artist: result.artist,
  });

  const bmsLinks = $derived(getBmsLinks(chartLike));

  function toValidUrl(raw: string | undefined): string | undefined {
    const s = (raw ?? "").trim();
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return `https:${s}`;
    if (s.startsWith("/")) return s;
    if (/^[\w.-]+\.[A-Za-z]{2,}(?:\/.*)?$/.test(s)) return `https://${s}`;
    return undefined;
  }
</script>

<GlassContainer padding="lg" rounded="lg" class="mb-6">
  <!-- 谱面基本信息 -->
  <div class="mb-4">
    <h3 class="mb-1 text-[1.2rem] font-bold text-white">{result.title ?? "(无标题)"}</h3>
    <p class="text-white/70">{result.artist ?? "(未知艺术家)"}</p>
    {#if !result.sha256}
      <p class="mt-1 text-[0.8rem] text-white/40">（仅有 MD5，无 SHA256）</p>
    {/if}
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
    {#each result.appearances as entry (entry.tableId + "-" + entry.chart.level)}
      {@const bundleUrl = toValidUrl(entry.chart.url)}
      {@const diffUrl = toValidUrl(entry.chart.url_diff)}
      {@const tableHref = `/bms/table/mirror/${entry.tableId}`}
      <div class="rounded-[10px] bg-black/20 px-4 py-3">
        <div class="flex items-center gap-3">
          <span
            class="inline-block rounded-[8px] bg-[#4caf50]/20 px-3 py-1 text-[0.9rem] font-bold text-[#4caf50]"
          >
            {entry.chart.level ?? "?"}
          </span>
          <a class="text-white no-underline transition-colors hover:text-[#64b5f6]" href={tableHref}>
            {entry.tableName}
          </a>
        </div>
        {#if entry.chart.comment}
          <p class="mt-1.5 text-[0.85rem] text-white/50">{entry.chart.comment}</p>
        {/if}
        {#if bundleUrl ?? diffUrl}
          <div class="mt-2 flex flex-row flex-wrap gap-[0.3rem]">
            {#if bundleUrl}
              <GradientButton
                variant="green"
                href={bundleUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="min-w-17 flex-1"
              >
                📦 同捆
              </GradientButton>
            {/if}
            {#if diffUrl}
              <GradientButton
                variant="blue"
                href={diffUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="min-w-17 flex-1"
              >
                🔄 差分
              </GradientButton>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</GlassContainer>
