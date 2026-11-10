<script lang="ts">
  import { formatConstraint, trophyEmoji } from "@brightmeows/bms/constants";
  import {
    COURSE_CONSTRAINTS,
    TROPHY_NAMES,
    courseChartResolvedIn,
    courseHashIssue,
    type EditableCourse,
  } from "@brightmeows/bms/course";
  import {
    buildEntryHashSet,
    entryLabel,
    filterEntryIndices,
    moveItem,
  } from "@brightmeows/bms/editor";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import Plus from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";
  import type { Action } from "svelte/action";

  import CourseRow from "./CourseRow.svelte";
  import RowActionMenu from "./RowActionMenu.svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import ToggleButton from "#lib/components/ui/ToggleButton.svelte";
  import {
    badgeWarningSm,
    btnGhost,
    btnIconDanger,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { DeepReadonly } from "#lib/types/bms-view.js";
  import { createDragList, type DragItemOptions } from "#lib/utils/ui/dnd-list.svelte.js";

  /**
   * 编辑态段位行：摘要、行头操作与展开后的全宽表单。
   * 受控组件：course 以深度只读视图传入仅供渲染，写入统一经 onedit 上抛，
   * 由 CoursePanel 执行并触发 onChange（漏标 dirty 在结构上不可能）。
   * 展开表单按名称、约束、奖杯、谱面、自定义分区，默认只开名称与谱面。
   */
  interface Props {
    /** 只读视图：渲染用；写入经 onedit 收口（见文件头注）。 */
    course: DeepReadonly<EditableCourse>;
    entries: Record<string, unknown>[];
    disabled: boolean;
    expanded: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    /** 组内拖拽：行动作、本行扁平下标与落点下标；未传时不启用拖拽。 */
    dragItem?: Action<HTMLElement, DragItemOptions> | undefined;
    dragIndex?: number | undefined;
    dragDropTargetIndex?: number | null | undefined;
    onToggle: () => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    /** 写入收口：mutator 拿到可写 course 原地修改，执行后由父级统一 onChange。 */
    onedit: (mutate: (target: EditableCourse) => void) => void;
  }

  let {
    course,
    entries,
    disabled,
    expanded,
    canMoveUp,
    canMoveDown,
    dragItem = undefined,
    dragIndex = -1,
    dragDropTargetIndex = null,
    onToggle,
    onDelete,
    onMoveUp,
    onMoveDown,
    onedit,
  }: Props = $props();

  const PICKER_LIMIT = 20;

  let pickerOpen = $state(false);
  let pickerQuery = $state("");

  const rowDrag = $derived(
    dragItem === undefined
      ? undefined
      : { item: dragItem, index: dragIndex, dropTargetIndex: dragDropTargetIndex, disabled }
  );

  const chartDnd = createDragList({
    enabled: () => !disabled,
    onMove: (from, to) => {
      onedit((target) => {
        target.charts = moveItem(target.charts, from, to);
      });
    },
  });

  const knownHashes = $derived(buildEntryHashSet(entries));
  const pickerResults = $derived(
    pickerOpen
      ? filterEntryIndices(entries, { level: { kind: "all" }, query: pickerQuery }).slice(
          0,
          PICKER_LIMIT
        )
      : []
  );

  function describe(entry: Record<string, unknown>): { label: string; hash: string } {
    const md5 = typeof entry.md5 === "string" ? entry.md5 : "";
    const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : "";
    const hash = md5 !== "" ? md5 : sha256;
    return { label: entryLabel(entry) || hash || m["editor.entry_unnamed"](), hash };
  }

  // mutator 形参统一命名 target（可写写入目标），避开与只读 prop course 的遮蔽
  // （no-shadow）；写入后由 onedit 的执行方无条件触发 onChange。

  function toggleConstraint(value: string): void {
    onedit((target) => {
      target.constraints = target.constraints.includes(value)
        ? target.constraints.filter((item) => item !== value)
        : [...target.constraints, value];
    });
  }

  function addTrophy(): void {
    onedit((target) => {
      target.trophies = [
        ...target.trophies,
        { name: "goldmedal", missrateText: "", scorerateText: "", extra: {} },
      ];
    });
  }

  function setTrophyName(index: number, name: string): void {
    onedit((target) => {
      const trophy = target.trophies[index];
      if (trophy !== undefined) trophy.name = name;
    });
  }

  function setTrophyMissrate(index: number, missrateText: string): void {
    onedit((target) => {
      const trophy = target.trophies[index];
      if (trophy !== undefined) trophy.missrateText = missrateText;
    });
  }

  function setTrophyScorerate(index: number, scorerateText: string): void {
    onedit((target) => {
      const trophy = target.trophies[index];
      if (trophy !== undefined) trophy.scorerateText = scorerateText;
    });
  }

  function removeTrophy(index: number): void {
    onedit((target) => {
      target.trophies = target.trophies.filter((_, i) => i !== index);
    });
  }

  function addChartRow(md5: string, sha256: string, levelText: string): void {
    onedit((target) => {
      target.charts = [...target.charts, { md5, sha256, levelText, extra: {} }];
    });
  }

  function addEmptyChart(): void {
    addChartRow("", "", "");
  }

  function setChartMd5(index: number, md5: string): void {
    onedit((target) => {
      const chart = target.charts[index];
      if (chart !== undefined) chart.md5 = md5;
    });
  }

  function setChartSha256(index: number, sha256: string): void {
    onedit((target) => {
      const chart = target.charts[index];
      if (chart !== undefined) chart.sha256 = sha256;
    });
  }

  function setChartLevel(index: number, levelText: string): void {
    onedit((target) => {
      const chart = target.charts[index];
      if (chart !== undefined) chart.levelText = levelText;
    });
  }

  function removeChart(index: number): void {
    onedit((target) => {
      target.charts = target.charts.filter((_, i) => i !== index);
    });
  }

  function moveChart(index: number, delta: number): void {
    onedit((target) => {
      target.charts = moveItem(target.charts, index, index + delta);
    });
  }

  function openPicker(): void {
    pickerOpen = !pickerOpen;
    pickerQuery = "";
  }

  function addFromPicker(entry: Record<string, unknown>): void {
    const md5 = typeof entry.md5 === "string" ? entry.md5 : "";
    const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : "";
    const levelText = typeof entry.level === "string" ? entry.level : "";
    addChartRow(md5, sha256, levelText);
  }
</script>

<CourseRow
  {expanded}
  dragItem={rowDrag?.item}
  dragIndex={rowDrag?.index}
  dropTarget={rowDrag !== undefined && rowDrag.dropTargetIndex === rowDrag.index}
  dragDisabled={rowDrag?.disabled ?? true}
>
  {#snippet summary()}
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span class="text-[1rem] font-semibold text-white">
        {course.name || m["course.unnamed"]()}
      </span>
      {#each course.constraints as constraint (constraint)}
        <span class={badgeWarningSm}>
          {formatConstraint(constraint)}
        </span>
      {/each}
      {#if course.trophies.length > 0}
        <span class="flex flex-wrap items-center gap-1 text-[0.8rem] text-white-50">
          {#each course.trophies as trophy, index (index)}
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
    {#if dragItem !== undefined}
      <span class="cursor-grab text-white-35" aria-hidden="true">
        <svg class="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>
    {/if}
    <ToggleButton
      size="xs"
      {expanded}
      label={expanded ? m["common.collapse"]() : m["common.edit"]()}
      {onToggle}
    />
    <RowActionMenu
      {disabled}
      items={[
        {
          label: m["editor.level_order_move_up"](),
          disabled: disabled || !canMoveUp,
          onselect: onMoveUp,
        },
        {
          label: m["editor.level_order_move_down"](),
          disabled: disabled || !canMoveDown,
          onselect: onMoveDown,
        },
        { label: m["editor.course_remove"](), danger: true, disabled, onselect: onDelete },
      ]}
    />
  {/snippet}

  {#snippet children()}
    <div class="flex flex-col gap-4">
      <label class="block">
        <span class="mb-1 block text-[0.8rem] text-white-60">{m["editor.course_name"]()}</span>
        <input
          class="{inputEditorMono} max-w-120"
          type="text"
          value={course.name}
          placeholder={m["editor.course_name_placeholder"]()}
          oninput={(event) =>
            onedit((target) => {
              target.name = event.currentTarget.value;
            })}
          {disabled}
        />
      </label>

      <DetailsPanel summary={m["editor.course_constraint"]()} variant="plain" sub={true}>
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          {#each [...COURSE_CONSTRAINTS, ...course.constraints.filter((item) => !COURSE_CONSTRAINTS.includes(item))] as constraint (constraint)}
            <label class="flex cursor-pointer items-center gap-1.5 text-[0.85rem] text-white-75">
              <input
                type="checkbox"
                checked={course.constraints.includes(constraint)}
                {disabled}
                onchange={() => toggleConstraint(constraint)}
              />
              {formatConstraint(constraint)}
            </label>
          {/each}
        </div>
      </DetailsPanel>

      <DetailsPanel summary={m["editor.course_trophy"]()} variant="plain" sub={true}>
        {#snippet actions()}
          <button class={btnGhost} type="button" {disabled} onclick={addTrophy}>
            <Plus class="size-4 shrink-0" aria-hidden="true" />
            {m["editor.course_trophy_add"]()}
          </button>
        {/snippet}
        {#if course.trophies.length > 0}
          <div class="flex flex-col gap-2">
            {#each course.trophies as trophy, index (index)}
              <div class="flex flex-wrap items-center gap-2">
                <input
                  class="{inputEditorMono} max-w-44 flex-1"
                  type="text"
                  list="editor-trophy-names"
                  value={trophy.name}
                  placeholder={m["editor.course_trophy_name"]()}
                  oninput={(event) => setTrophyName(index, event.currentTarget.value)}
                  {disabled}
                />
                <input
                  class="{inputEditorMono} max-w-28"
                  type="text"
                  inputmode="decimal"
                  value={trophy.missrateText}
                  placeholder={m["editor.course_trophy_missrate"]()}
                  oninput={(event) => setTrophyMissrate(index, event.currentTarget.value)}
                  {disabled}
                />
                <input
                  class="{inputEditorMono} max-w-28"
                  type="text"
                  inputmode="decimal"
                  value={trophy.scorerateText}
                  placeholder={m["editor.course_trophy_scorate"]()}
                  oninput={(event) => setTrophyScorerate(index, event.currentTarget.value)}
                  {disabled}
                />
                <button
                  class={btnIconDanger}
                  type="button"
                  {disabled}
                  title={m["editor.course_trophy_remove"]()}
                  aria-label={m["editor.course_trophy_remove"]()}
                  onclick={() => removeTrophy(index)}
                >
                  <Trash2 class="size-4" aria-hidden="true" />
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-[0.85rem] text-white-50">{m["editor.course_trophy_empty"]()}</p>
        {/if}
      </DetailsPanel>

      <DetailsPanel
        summary={m["editor.course_charts"]()}
        hint={m["editor.course_charts_hint"]()}
        defaultOpen={true}
        variant="plain"
        sub={true}
      >
        {#snippet actions()}
          <div class="flex gap-2">
            <button class={btnGhost} type="button" {disabled} onclick={openPicker}>
              <Search class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.course_chart_pick"]()}
            </button>
            <button class={btnGhost} type="button" {disabled} onclick={addEmptyChart}>
              <Plus class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.course_chart_add"]()}
            </button>
          </div>
        {/snippet}

        {#if pickerOpen}
          <div class="mb-2 rounded-lg border border-accent/40 bg-accent/10 p-2">
            <div class="mb-2 flex items-center gap-2">
              <input
                class="{inputEditorMono} flex-1"
                type="text"
                bind:value={pickerQuery}
                placeholder={m["editor.course_picker_search"]()}
                {disabled}
              />
              <button class={btnGhost} type="button" onclick={openPicker}>
                <X class="size-4 shrink-0" aria-hidden="true" />
                {m["common.cancel"]()}
              </button>
            </div>
            {#if pickerResults.length === 0}
              <p class="text-[0.85rem] text-white-50">{m["editor.course_picker_empty"]()}</p>
            {:else}
              <ul class="max-h-64 overflow-auto">
                {#each pickerResults as index (index)}
                  {@const entry = entries[index] ?? {}}
                  {@const info = describe(entry)}
                  <li class="flex items-center gap-2 border-b border-white-5 py-1 last:border-b-0">
                    <span class="min-w-0 flex-1 truncate text-[0.85rem] text-white-80">
                      {info.label}
                    </span>
                    <span class="hidden font-mono text-[0.75rem] text-white-40 sm:inline">
                      {info.hash.slice(0, 12)}…
                    </span>
                    <button
                      class={btnGhost}
                      type="button"
                      {disabled}
                      onclick={() => addFromPicker(entry)}
                    >
                      <Plus class="size-4 shrink-0" aria-hidden="true" />
                      {m["editor.course_picker_add"]()}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}

        {#if course.charts.length > 0}
          <div class="flex flex-col gap-2">
            {#each course.charts as chart, index (index)}
              {@const issue = courseHashIssue(chart)}
              {@const resolved = courseChartResolvedIn(knownHashes, chart)}
              <div
                use:chartDnd.item={{ index, disabled }}
                class="rounded-lg border border-white-10 bg-black-10 p-2 {chartDnd.dropTargetIndex ===
                index
                  ? 'border-accent/60'
                  : ''}"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="cursor-grab text-white-35" aria-hidden="true">
                    <GripVertical class="size-4" />
                  </span>
                  <input
                    class="{inputEditorMono} min-w-52 flex-1 {issue === 'md5'
                      ? 'border-red-400/60'
                      : ''}"
                    type="text"
                    value={chart.md5}
                    placeholder={m["editor.course_chart_md5"]()}
                    oninput={(event) => setChartMd5(index, event.currentTarget.value)}
                    {disabled}
                  />
                  <input
                    class="{inputEditorMono} min-w-52 flex-[1.4] {issue === 'sha256'
                      ? 'border-red-400/60'
                      : ''}"
                    type="text"
                    value={chart.sha256}
                    placeholder={m["editor.course_chart_sha256"]()}
                    oninput={(event) => setChartSha256(index, event.currentTarget.value)}
                    {disabled}
                  />
                  <input
                    class="{inputEditorMono} max-w-24"
                    type="text"
                    value={chart.levelText}
                    placeholder={m["editor.course_chart_level"]()}
                    oninput={(event) => setChartLevel(index, event.currentTarget.value)}
                    {disabled}
                  />
                </div>
                <div class="mt-1.5 flex flex-wrap items-center gap-2">
                  <span class="text-[0.78rem] {resolved ? 'text-success' : 'text-amber-300'}">
                    {resolved
                      ? m["editor.course_chart_resolved"]()
                      : m["editor.course_chart_unresolved"]()}
                  </span>
                  {#if issue === "missing"}
                    <span class="text-[0.78rem] text-red-300">
                      {m["editor.course_chart_identity"]()}
                    </span>
                  {:else if issue !== "ok"}
                    <span class="text-[0.78rem] text-red-300">
                      {m["editor.course_chart_hash_invalid"]({ field: issue })}
                    </span>
                  {/if}
                  <div class="ml-auto flex items-center gap-1">
                    <RowActionMenu
                      {disabled}
                      items={[
                        {
                          label: m["editor.level_order_move_up"](),
                          disabled,
                          onselect: () => moveChart(index, -1),
                        },
                        {
                          label: m["editor.level_order_move_down"](),
                          disabled,
                          onselect: () => moveChart(index, 1),
                        },
                        {
                          label: m["editor.course_chart_remove"](),
                          danger: true,
                          disabled,
                          onselect: () => removeChart(index),
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-[0.85rem] text-white-50">{m["editor.course_charts_empty"]()}</p>
        {/if}
      </DetailsPanel>

      {#if Object.keys(course.extra).length > 0}
        <details class="rounded-md border border-white-10 p-2">
          <summary class="cursor-pointer text-[0.78rem] text-white-50">
            {m["editor.course_extra"]()}
          </summary>
          <pre
            class="mt-1 max-h-40 overflow-auto font-mono text-[0.75rem] whitespace-pre-wrap text-white-60">{JSON.stringify(
              course.extra,
              null,
              2
            )}</pre>
        </details>
      {/if}
    </div>

    <datalist id="editor-trophy-names">
      {#each TROPHY_NAMES as name (name)}
        <option value={name}></option>
      {/each}
    </datalist>
  {/snippet}
</CourseRow>
