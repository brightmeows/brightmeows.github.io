<script lang="ts">
  import { formatConstraint, trophyEmoji } from "@brightmeows/bms/constants";
  import {
    COURSE_CONSTRAINTS,
    TROPHY_NAMES,
    buildEntryHashSet,
    courseChartResolvedIn,
    courseHashIssue,
    type EditableCourse,
  } from "@brightmeows/bms/course";
  import { entryLabel, filterEntryIndices, moveItem } from "@brightmeows/bms/editor";

  import CourseRow from "./CourseRow.svelte";

  import {
    btnGhost,
    btnGhostXs,
    btnIcon,
    btnIconDanger,
    inputEditorMono,
  } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /** 编辑态段位行：摘要、行头操作与展开后的全宽表单。 */
  interface Props {
    course: EditableCourse;
    entries: Record<string, unknown>[];
    disabled: boolean;
    expanded: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onToggle: () => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onChange: () => void;
  }

  let {
    course,
    entries,
    disabled,
    expanded,
    canMoveUp,
    canMoveDown,
    onToggle,
    onDelete,
    onMoveUp,
    onMoveDown,
    onChange,
  }: Props = $props();

  const PICKER_LIMIT = 20;

  let pickerOpen = $state(false);
  let pickerQuery = $state("");

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

  function notify(): void {
    onChange();
  }

  function toggleConstraint(value: string): void {
    course.constraints = course.constraints.includes(value)
      ? course.constraints.filter((item) => item !== value)
      : [...course.constraints, value];
    notify();
  }

  function addTrophy(): void {
    course.trophies = [
      ...course.trophies,
      { name: "goldmedal", missrateText: "", scorerateText: "", extra: {} },
    ];
    notify();
  }

  function removeTrophy(index: number): void {
    course.trophies = course.trophies.filter((_, i) => i !== index);
    notify();
  }

  function addChartRow(md5: string, sha256: string, levelText: string): void {
    course.charts = [...course.charts, { md5, sha256, levelText, extra: {} }];
    notify();
  }

  function addEmptyChart(): void {
    addChartRow("", "", "");
  }

  function removeChart(index: number): void {
    course.charts = course.charts.filter((_, i) => i !== index);
    notify();
  }

  function moveChart(index: number, delta: number): void {
    course.charts = moveItem(course.charts, index, index + delta);
    notify();
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

<CourseRow {expanded}>
  {#snippet summary()}
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span class="text-[1rem] font-semibold text-white">
        {course.name || m["course.unnamed"]()}
      </span>
      {#each course.constraints as constraint (constraint)}
        <span
          class="inline-block rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[0.75rem] text-warning"
        >
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
    <button class={btnGhostXs} type="button" aria-expanded={expanded} onclick={onToggle}>
      {expanded ? m["common.collapse"]() : m["common.edit"]()}
    </button>
    <button
      class={btnIcon}
      type="button"
      disabled={disabled || !canMoveUp}
      title={m["editor.level_order_move_up"]()}
      aria-label={m["editor.level_order_move_up"]()}
      onclick={onMoveUp}
    >
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg
      >
    </button>
    <button
      class={btnIcon}
      type="button"
      disabled={disabled || !canMoveDown}
      title={m["editor.level_order_move_down"]()}
      aria-label={m["editor.level_order_move_down"]()}
      onclick={onMoveDown}
    >
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
      >
    </button>
    <button
      class={btnIconDanger}
      type="button"
      {disabled}
      title={m["editor.course_remove"]()}
      aria-label={m["editor.course_remove"]()}
      onclick={onDelete}
    >
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </svg>
    </button>
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
          oninput={(event) => {
            course.name = event.currentTarget.value;
            notify();
          }}
          {disabled}
        />
      </label>

      <div>
        <div class="mb-1 text-[0.8rem] text-white-60">{m["editor.course_constraint"]()}</div>
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
      </div>

      <div>
        <div class="mb-1 flex items-center gap-2">
          <span class="text-[0.8rem] text-white-60">{m["editor.course_trophy"]()}</span>
          <button class="{btnGhost} ml-auto" type="button" {disabled} onclick={addTrophy}>
            {m["editor.course_trophy_add"]()}
          </button>
        </div>
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
                  oninput={(event) => {
                    trophy.name = event.currentTarget.value;
                    notify();
                  }}
                  {disabled}
                />
                <input
                  class="{inputEditorMono} max-w-28"
                  type="text"
                  inputmode="decimal"
                  value={trophy.missrateText}
                  placeholder={m["editor.course_trophy_missrate"]()}
                  oninput={(event) => {
                    trophy.missrateText = event.currentTarget.value;
                    notify();
                  }}
                  {disabled}
                />
                <input
                  class="{inputEditorMono} max-w-28"
                  type="text"
                  inputmode="decimal"
                  value={trophy.scorerateText}
                  placeholder={m["editor.course_trophy_scorate"]()}
                  oninput={(event) => {
                    trophy.scorerateText = event.currentTarget.value;
                    notify();
                  }}
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
                  <svg
                    class="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-[0.85rem] text-white-50">{m["editor.course_trophy_empty"]()}</p>
        {/if}
      </div>

      <div>
        <div class="mb-1 flex flex-wrap items-center gap-2">
          <span class="text-[0.8rem] text-white-60">{m["editor.course_charts"]()}</span>
          <span class="text-[0.78rem] text-white-40">{m["editor.course_charts_hint"]()}</span>
          <div class="ml-auto flex gap-2">
            <button class={btnGhost} type="button" {disabled} onclick={openPicker}>
              {m["editor.course_chart_pick"]()}
            </button>
            <button class={btnGhost} type="button" {disabled} onclick={addEmptyChart}>
              {m["editor.course_chart_add"]()}
            </button>
          </div>
        </div>

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
              <div class="rounded-lg border border-white-10 bg-black-10 p-2">
                <div class="flex flex-wrap items-center gap-2">
                  <input
                    class="{inputEditorMono} min-w-52 flex-1 {issue === 'md5'
                      ? 'border-red-400/60'
                      : ''}"
                    type="text"
                    value={chart.md5}
                    placeholder={m["editor.course_chart_md5"]()}
                    oninput={(event) => {
                      chart.md5 = event.currentTarget.value;
                      notify();
                    }}
                    {disabled}
                  />
                  <input
                    class="{inputEditorMono} min-w-52 flex-[1.4] {issue === 'sha256'
                      ? 'border-red-400/60'
                      : ''}"
                    type="text"
                    value={chart.sha256}
                    placeholder={m["editor.course_chart_sha256"]()}
                    oninput={(event) => {
                      chart.sha256 = event.currentTarget.value;
                      notify();
                    }}
                    {disabled}
                  />
                  <input
                    class="{inputEditorMono} max-w-24"
                    type="text"
                    value={chart.levelText}
                    placeholder={m["editor.course_chart_level"]()}
                    oninput={(event) => {
                      chart.levelText = event.currentTarget.value;
                      notify();
                    }}
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
                    <button
                      class={btnIcon}
                      type="button"
                      {disabled}
                      title={m["editor.level_order_move_up"]()}
                      aria-label={m["editor.level_order_move_up"]()}
                      onclick={() => moveChart(index, -1)}
                    >
                      <svg
                        class="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg
                      >
                    </button>
                    <button
                      class={btnIcon}
                      type="button"
                      {disabled}
                      title={m["editor.level_order_move_down"]()}
                      aria-label={m["editor.level_order_move_down"]()}
                      onclick={() => moveChart(index, 1)}
                    >
                      <svg
                        class="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
                      >
                    </button>
                    <button
                      class={btnIconDanger}
                      type="button"
                      {disabled}
                      title={m["editor.course_chart_remove"]()}
                      aria-label={m["editor.course_chart_remove"]()}
                      onclick={() => removeChart(index)}
                    >
                      <svg
                        class="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-[0.85rem] text-white-50">{m["editor.course_charts_empty"]()}</p>
        {/if}
      </div>

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
