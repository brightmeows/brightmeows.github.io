<script lang="ts">
  import { formatConstraint, trophyEmoji } from "@brightmeows/bms/constants";
  import type { Course } from "@brightmeows/bms/format";

  import CourseRow from "./CourseRow.svelte";

  import ToggleButton from "#lib/components/ui/ToggleButton.svelte";
  import { badgeWarningMd, badgeWarningSm } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /** 查看态段位行：摘要加可展开的只读详情。 */
  interface Props {
    course: Course;
    symbol: string;
    expanded: boolean;
    onToggle: () => void;
  }

  let { course, symbol, expanded, onToggle }: Props = $props();

  function hashPrefix(hash: string | undefined): string {
    if (!hash) return "";
    return hash.slice(0, 8);
  }
</script>

<CourseRow {expanded}>
  {#snippet summary()}
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span class="text-[1rem] font-semibold text-white">
        {course.name || m["course.unnamed"]()}
      </span>
      {#each course.constraint ?? [] as constraint (constraint)}
        <span class={badgeWarningSm}>
          {formatConstraint(constraint)}
        </span>
      {/each}
      {#if course.trophy && course.trophy.length > 0}
        <span class="flex flex-wrap items-center gap-1 text-[0.8rem] text-white-50">
          {#each course.trophy as trophy, index (index)}
            <span>{trophyEmoji(trophy.name)} {trophy.name}</span>
          {/each}
        </span>
      {/if}
      <span class="text-[0.8rem] text-white-40">
        {m["table.chart_count"]({ count: course.charts.length })}
      </span>
    </div>
  {/snippet}

  {#snippet actions()}
    <ToggleButton
      size="xs"
      {expanded}
      label={expanded ? m["common.collapse"]() : m["common.details"]()}
      {onToggle}
    />
  {/snippet}

  {#snippet children()}
    <div class="flex flex-col gap-3">
      {#if course.constraint && course.constraint.length > 0}
        <div>
          <div class="mb-1 text-[0.8rem] text-white-60">{m["editor.course_constraint"]()}</div>
          <div class="flex flex-wrap gap-2">
            {#each course.constraint as constraint (constraint)}
              <span class={badgeWarningMd}>
                {formatConstraint(constraint)}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      {#if course.trophy && course.trophy.length > 0}
        <div>
          <div class="mb-1 text-[0.8rem] text-white-60">{m["editor.course_trophy"]()}</div>
          <div class="flex flex-col gap-1">
            {#each course.trophy as trophy, index (index)}
              <div class="flex flex-wrap items-center gap-2 text-[0.85rem] text-white-70">
                <span>{trophyEmoji(trophy.name)}</span>
                <span>{trophy.name}</span>
                <span class="text-white-50">
                  {#if trophy.missrate !== undefined && trophy.scorerate !== undefined}
                    miss ≤{trophy.missrate}% / score ≥{trophy.scorerate}%
                  {:else if trophy.missrate !== undefined}
                    miss ≤{trophy.missrate}%
                  {:else if trophy.scorerate !== undefined}
                    score ≥{trophy.scorerate}%
                  {/if}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div>
        <div class="mb-1 text-[0.8rem] text-white-60">{m["editor.course_charts"]()}</div>
        {#if course.charts.length > 0}
          <ol class="space-y-1.5">
            {#each course.charts as chart, chi (chart.md5 ?? chart.sha256 ?? chi)}
              <li class="flex items-start gap-2 text-[0.85rem] leading-tight text-white-80">
                <span class="mt-px min-w-[1.2rem] font-mono text-[0.75rem] text-white-50">
                  {chi + 1}.
                </span>
                <span class="flex-1">
                  {#if chart.resolved && chart.title}
                    <span class="font-medium text-white">{chart.title}</span>
                    {#if chart.artist}
                      <span class="text-white-50"> / {chart.artist}</span>
                    {/if}
                    {#if chart.level}
                      <span
                        class="ml-1.5 inline-block rounded-sm bg-white-10 px-1.5 py-0.5 font-mono text-[0.75rem] text-white-60"
                      >
                        {symbol}{chart.level}
                      </span>
                    {/if}
                  {:else}
                    <span class="font-mono text-white-40">
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
          <p class="text-[0.85rem] text-white-40 italic">{m["course.no_charts"]()}</p>
        {/if}
      </div>
    </div>
  {/snippet}
</CourseRow>
