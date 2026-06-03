<script lang="ts">
  import BmsLinkButtons from "./BmsLinkButtons.svelte";

  import { GlassContainer, GradientButton } from "$lib/components/ui";
  import type { SearchResult } from "$lib/data/bms-search";
  import type { ChartData } from "$lib/types/bms";
  import { getBmsLinks } from "$lib/utils/bms-table";
  import { writeToClipboard } from "$lib/utils/clipboard";

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

  let copiedField = $state<string | null>(null);

  async function copyHash(field: string, value: string): Promise<void> {
    const ok = await writeToClipboard(value);
    if (ok) {
      copiedField = field;
      setTimeout(() => {
        copiedField = null;
      }, 1500);
    }
  }

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
  <!-- 谱面基本信息 + 外部链接（同行） -->
  <div class="mb-4 flex items-start justify-between gap-4">
    <div class="min-w-0">
      <h3 class="mb-1 text-[1.2rem] font-bold text-white">{result.title ?? "(无标题)"}</h3>
      <p class="text-white/70">{result.artist ?? "(未知艺术家)"}</p>
      {#if !result.sha256}
        <p class="mt-1 text-[0.8rem] text-white/40">（仅有 MD5，无 SHA256）</p>
      {/if}
    </div>
    <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {#if result.md5}
        <button
          type="button"
          onclick={() => void copyHash("md5", result.md5)}
          title={copiedField === "md5" ? "已复制" : `MD5: ${result.md5}`}
          class="cursor-pointer rounded-[6px] px-2 py-1 text-[0.75rem] font-medium text-white transition-colors {copiedField ===
          'md5'
            ? 'bg-[#4caf50]'
            : 'bg-[#607d8b] hover:bg-[#78909c]'}"
        >
          {copiedField === "md5" ? "已复制" : "复制MD5"}
        </button>
      {/if}
      {#if result.sha256}
        <button
          type="button"
          onclick={() => void copyHash("sha256", result.sha256)}
          title={copiedField === "sha256" ? "已复制" : `SHA256: ${result.sha256.slice(0, 16)}...`}
          class="cursor-pointer rounded-[6px] px-2 py-1 text-[0.75rem] font-medium text-white transition-colors {copiedField ===
          'sha256'
            ? 'bg-[#4caf50]'
            : 'bg-[#607d8b] hover:bg-[#78909c]'}"
        >
          {copiedField === "sha256" ? "已复制" : "复制SHA256"}
        </button>
      {/if}
      <BmsLinkButtons chart={chartLike} {bmsLinks} />
    </div>
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
      <div class="flex items-center justify-between gap-3 rounded-[10px] bg-black/20 px-4 py-3">
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <span
              class="inline-block rounded-[8px] bg-[#4caf50]/20 px-3 py-1 text-[0.9rem] font-bold text-[#4caf50]"
            >
              {entry.chart.level ?? "?"}
            </span>
            <a
              class="text-white no-underline transition-colors hover:text-[#64b5f6]"
              href={tableHref}
            >
              {entry.tableName}
            </a>
          </div>
          {#if entry.chart.comment}
            <p class="mt-1.5 text-[0.85rem] text-white/50">{entry.chart.comment}</p>
          {/if}
        </div>
        {#if bundleUrl ?? diffUrl}
          <div class="flex shrink-0 flex-row gap-[0.3rem]">
            {#if bundleUrl}
              <GradientButton
                variant="green"
                href={bundleUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
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
                size="sm"
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
