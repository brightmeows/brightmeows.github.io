<script lang="ts">
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { formatConstraint, trophyEmoji } from "$lib/constants/bms";
  import { m } from "$lib/paraglide/messages.js";
  import type { ResolvedCourseGroup } from "$lib/types/bms";

  interface Props {
    groups: ResolvedCourseGroup[];
    symbol?: string;
  }

  let { groups = [] as ResolvedCourseGroup[], symbol = "" }: Props = $props();

  let collapsed = $state(false);
  let groupMode = $state(true);

  /** 是否有多组可切换 */
  let hasMultipleGroups = $derived(groups.length > 1);

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
  <div class="flex flex-wrap items-center justify-center gap-3 {collapsed ? '' : 'mb-6'}">
    <button
      class="section-title flex cursor-pointer items-center gap-2 border-none bg-transparent text-white"
      type="button"
      onclick={() => (collapsed = !collapsed)}
      aria-expanded={!collapsed}
    >
      {m["course.heading"]()}
      <span
        class="text-[0.8rem] text-white/50 transition-transform duration-200 {collapsed
          ? ''
          : 'rotate-180'}"
      >
        ▼
      </span>
    </button>

    {#if !collapsed && hasMultipleGroups}
      <label
        class="flex cursor-pointer items-center gap-1.5 rounded-[6px] border px-2.5 py-0.5 text-[0.8rem] transition-colors duration-200 select-none {groupMode
          ? 'border-accent bg-accent/20 text-accent'
          : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'}"
      >
        <Checkbox size="sm" checked={groupMode} onchange={(v: boolean) => (groupMode = v)} />
        {m["course.grouped_display"]()}
      </label>
    {/if}
  </div>

  {#if !collapsed}
    {#each effectiveGroups as group, gi (gi)}
      {#if groupMode && effectiveGroups.length > 1}
        <h4 class="mt-6 mb-4 text-center text-[1.2rem] font-semibold text-white/80 first:mt-0">
          {m["course.group_n"]({ n: gi + 1 })}
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
                    class="inline-block rounded-[6px] border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[0.8rem] text-warning"
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
                        <span class="ml-1.5 text-[0.75rem] text-warning/60">
                          {m["course.unmatched"]()}
                        </span>
                      {/if}
                    </span>
                  </li>
                {/each}
              </ol>
            {:else}
              <p class="text-[0.85rem] text-white/40 italic">{m["course.no_charts"]()}</p>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  {/if}
{/if}
