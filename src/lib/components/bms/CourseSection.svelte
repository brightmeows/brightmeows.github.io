<script lang="ts">
  import type { ResolvedCourseGroup } from "$lib/types/bms";

  interface Props {
    groups: ResolvedCourseGroup[];
    symbol?: string;
  }

  let { groups = [] as ResolvedCourseGroup[], symbol = "" }: Props = $props();

  let collapsed = $state(false);
  let groupMode = $state(false);

  /** 是否有多组可切换 */
  let hasMultipleGroups = $derived(groups.length > 1);

  /** 约束值→显示文案 */
  function formatConstraint(c: string): string {
    const map: Record<string, string> = {
      grade_random: "RANDOM 許可",
      grade_mirror: "MIRROR 許可",
      no_speed: "HI-SPEED 禁止",
      no_good: "GOOD 无效",
      no_great: "GREAT 无效",
      gauge_lr2: "LR2 段位槽",
      gauge_5k: "5K 段位槽",
      gauge_7k: "7K 段位槽",
      gauge_9k: "9K 段位槽",
      gauge_24k: "24K 段位槽",
    };
    return map[c] ?? c;
  }

  /** 奖牌 emoji */
  function trophyEmoji(name: string): string {
    const map: Record<string, string> = {
      goldmedal: "🥇",
      silvermedal: "🥈",
      bronzemedal: "🥉",
    };
    return map[name] ?? "🏅";
  }

  /** 截取 hash 前 8 位用于显示 */
  function hashPrefix(hash: string | undefined): string {
    if (!hash) return "";
    return hash.slice(0, 8);
  }

  /** 归一化后的分组列表：groupMode 为 false 时合并为单组 */
  let effectiveGroups = $derived.by<ResolvedCourseGroup[]>(() => {
    if (!groupMode || groups.length <= 1) {
      const flat = groups.flat();
      return flat.length > 0 ? [flat] : [];
    }
    return groups;
  });
</script>

{#if groups.length > 0}
  <!-- 可折叠标题 -->
  <div class="mb-6 flex flex-wrap items-center justify-center gap-3">
    <button
      class="section-title flex cursor-pointer items-center gap-2 border-none bg-transparent text-white"
      type="button"
      onclick={() => (collapsed = !collapsed)}
      aria-expanded={!collapsed}
    >
      段位认定
      <span
        class="text-[0.8rem] text-white/50 transition-transform duration-200 {collapsed
          ? ''
          : 'rotate-180'}"
      >
        ▼
      </span>
    </button>

    {#if hasMultipleGroups}
      <button
        class="cursor-pointer rounded-[6px] border px-2.5 py-0.5 text-[0.8rem] transition-colors duration-200 {groupMode
          ? 'border-[#64b5f6] bg-[#64b5f6]/20 text-[#64b5f6]'
          : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'}"
        type="button"
        onclick={() => (groupMode = !groupMode)}
      >
        {groupMode ? "分组显示" : "合并显示"}
      </button>
    {/if}
  </div>

  {#if !collapsed}
    {#each effectiveGroups as group, gi (gi)}
      {#if groupMode && effectiveGroups.length > 1}
        <h4 class="mt-6 mb-4 text-center text-[1.2rem] font-semibold text-white/80 first:mt-0">
          段位组 {gi + 1}
        </h4>
      {/if}

      <div class="mx-auto mb-8 grid max-w-[70rem] grid-cols-1 gap-6 md:grid-cols-3">
        {#each group as course, ci (course.name ?? ci)}
          <div class="rounded-[12px] border border-white/10 bg-white/[0.04] p-5">
            <!-- 段位名称 -->
            <h4 class="mb-3 text-[1.15rem] font-bold text-white">
              {course.name}
            </h4>

            <!-- 约束标签 -->
            {#if course.constraint && course.constraint.length > 0}
              <div class="mb-3 flex flex-wrap gap-2">
                {#each course.constraint as c (c)}
                  <span
                    class="inline-block rounded-[6px] border border-[#ff9800]/40 bg-[#ff9800]/10 px-2.5 py-0.5 text-[0.8rem] text-[#ff9800]"
                  >
                    {formatConstraint(c)}
                  </span>
                {/each}
              </div>
            {/if}

            <!-- 奖牌条件 -->
            {#if course.trophy && course.trophy.length > 0}
              <div class="mb-4 space-y-1">
                {#each course.trophy as t (t.name)}
                  <div class="flex items-center gap-2 text-[0.85rem] text-white/70">
                    <span>{trophyEmoji(t.name)}</span>
                    <span>
                      {#if t.missrate !== undefined && t.scorerate !== undefined}
                        miss ≤{t.missrate}% / score ≥{t.scorerate}%
                      {:else if t.missrate !== undefined}
                        miss ≤{t.missrate}%
                      {:else if t.scorerate !== undefined}
                        score ≥{t.scorerate}%
                      {:else}
                        {t.name}
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- 谱面列表（分隔线） -->
            {#if course.charts.length > 0}
              <hr class="mb-3 border-t border-white/10" />
              <ol class="space-y-2">
                {#each course.charts as chart, chi (chart.md5 ?? chart.sha256 ?? chi)}
                  <li class="flex items-start gap-2 text-[0.85rem] leading-tight text-white/80">
                    <span class="mt-px min-w-[1.2rem] font-mono text-[0.75rem] text-white/50">
                      {chi + 1}.
                    </span>
                    <span class="flex-1">
                      {#if chart.resolved && chart.title}
                        <span class="font-medium text-white">{chart.title}</span>
                        {#if chart.artist}
                          <span class="text-white/50"> / {chart.artist}</span>
                        {/if}
                        {#if chart.level}
                          <span
                            class="ml-1.5 inline-block rounded-[4px] bg-white/10 px-1.5 py-0.5 font-mono text-[0.75rem] text-white/60"
                          >
                            {symbol}{chart.level}
                          </span>
                        {/if}
                      {:else}
                        <span class="font-mono text-white/40">
                          {hashPrefix(chart.md5 ?? chart.sha256)}
                        </span>
                        <span class="ml-1.5 text-[0.75rem] text-[#ff9800]/60">（未匹配）</span>
                      {/if}
                    </span>
                  </li>
                {/each}
              </ol>
            {:else}
              <p class="text-[0.85rem] text-white/40 italic">无谱面数据</p>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  {/if}
{/if}
