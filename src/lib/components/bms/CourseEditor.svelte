<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import {
    COURSE_CONSTRAINTS,
    TROPHY_NAMES,
    addCourseToModel,
    addGroupToModel,
    buildEntryHashSet,
    courseChartResolvedIn,
    courseHashIssue,
    moveCourseInModel,
    removeCourseFromModel,
    removeGroupFromModel,
    type CourseModel,
    type EditableCourse,
  } from "$lib/utils/table-course";
  import { entryLabel, filterEntryIndices, moveItem } from "$lib/utils/table-editor";

  /**
   * 段位（course）结构化编辑器：分组与课程增删、constraint 多选、trophy 行与
   * charts 行（可从当前表条目挑选）。未知字段在 extra 里原样保留并以只读 JSON 展示。
   */
  interface Props {
    model: CourseModel;
    entries: Record<string, unknown>[];
    disabled?: boolean;
    onchange?: (() => void) | undefined;
  }

  let { model = $bindable(), entries, disabled = false, onchange }: Props = $props();

  const PICKER_LIMIT = 20;

  let pickerFor = $state<{ group: number; course: number } | null>(null);
  let pickerQuery = $state("");

  const knownHashes = $derived(buildEntryHashSet(entries));
  const pickerResults = $derived.by(() => {
    if (pickerFor === null) return [];
    return filterEntryIndices(entries, { level: { kind: "all" }, query: pickerQuery }).slice(
      0,
      PICKER_LIMIT
    );
  });

  function describe(entry: Record<string, unknown>): { label: string; hash: string } {
    const md5 = typeof entry.md5 === "string" ? entry.md5 : "";
    const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : "";
    const hash = md5 !== "" ? md5 : sha256;
    return { label: entryLabel(entry) || hash || m["editor.entry_unnamed"](), hash };
  }

  function notify(): void {
    onchange?.();
  }

  function toggleConstraint(course: EditableCourse, value: string): void {
    course.constraints = course.constraints.includes(value)
      ? course.constraints.filter((item) => item !== value)
      : [...course.constraints, value];
    notify();
  }

  function addTrophy(course: EditableCourse): void {
    course.trophies = [
      ...course.trophies,
      { name: "goldmedal", missrateText: "", scorerateText: "", extra: {} },
    ];
    notify();
  }

  function removeTrophy(course: EditableCourse, index: number): void {
    course.trophies = course.trophies.filter((_, i) => i !== index);
    notify();
  }

  function addChartRow(
    course: EditableCourse,
    md5: string,
    sha256: string,
    levelText: string
  ): void {
    course.charts = [...course.charts, { md5, sha256, levelText, extra: {} }];
    notify();
  }

  function removeChart(course: EditableCourse, index: number): void {
    course.charts = course.charts.filter((_, i) => i !== index);
    notify();
  }

  function moveChart(course: EditableCourse, index: number, delta: number): void {
    course.charts = moveItem(course.charts, index, index + delta);
    notify();
  }

  function openPicker(group: number, course: number): void {
    pickerFor =
      pickerFor?.group === group && pickerFor.course === course ? null : { group, course };
    pickerQuery = "";
  }

  function addFromPicker(target: EditableCourse, entry: Record<string, unknown>): void {
    const md5 = typeof entry.md5 === "string" ? entry.md5 : "";
    const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : "";
    const level = typeof entry.level === "string" ? entry.level : "";
    addChartRow(target, md5, sha256, level);
  }

  function pickerCourse(): EditableCourse | null {
    if (pickerFor === null) return null;
    return model.groups[pickerFor.group]?.courses[pickerFor.course] ?? null;
  }

  function addEmptyChart(course: EditableCourse): void {
    addChartRow(course, "", "", "");
  }

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono text-[0.85rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const iconButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const trashButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md text-red-200/80 transition-colors duration-200 hover:bg-red-400/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";
</script>

<section>
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <h3 class="tag-accent-sm">{m["editor.course_section"]()}</h3>
    <span class="text-[0.85rem] text-white/50">{m["editor.course_hint"]()}</span>
    <div class="ml-auto flex flex-wrap gap-2">
      {#if model.shape === "nested"}
        <button
          class={smallButton}
          type="button"
          {disabled}
          onclick={() => {
            model = addGroupToModel(model);
            notify();
          }}
        >
          {m["editor.course_group_add"]()}
        </button>
      {/if}
      <button
        class={smallButton}
        type="button"
        {disabled}
        onclick={() => {
          model = addCourseToModel(model);
          notify();
        }}
      >
        {m["editor.course_add"]()}
      </button>
    </div>
  </div>

  {#snippet courseCard(course: EditableCourse, groupIndex: number, courseIndex: number)}
    <div class="rounded-lg border border-white/15 bg-black/20 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[0.8rem] text-white/45">
          {m["editor.course_group_course"]({ group: groupIndex + 1, index: courseIndex + 1 })}
        </span>
        <div class="ml-auto flex items-center gap-1">
          <button
            class={iconButtonClass}
            type="button"
            {disabled}
            title={m["editor.level_order_move_up"]()}
            aria-label={m["editor.level_order_move_up"]()}
            onclick={() => {
              model = moveCourseInModel(model, groupIndex, courseIndex, -1);
              notify();
            }}
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
            class={iconButtonClass}
            type="button"
            {disabled}
            title={m["editor.level_order_move_down"]()}
            aria-label={m["editor.level_order_move_down"]()}
            onclick={() => {
              model = moveCourseInModel(model, groupIndex, courseIndex, 1);
              notify();
            }}
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
            class={trashButtonClass}
            type="button"
            {disabled}
            title={m["editor.course_remove"]()}
            aria-label={m["editor.course_remove"]()}
            onclick={() => {
              model = removeCourseFromModel(model, groupIndex, courseIndex);
              pickerFor = null;
              notify();
            }}
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

      <label class="mt-2 block">
        <span class="mb-1 block text-[0.8rem] text-white/60">{m["editor.course_name"]()}</span>
        <input
          class="{inputClass} max-w-120"
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

      <div class="mt-3">
        <div class="mb-1 text-[0.8rem] text-white/60">{m["editor.course_constraint"]()}</div>
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          {#each [...COURSE_CONSTRAINTS, ...course.constraints.filter((item) => !COURSE_CONSTRAINTS.includes(item))] as constraint (constraint)}
            <label class="flex cursor-pointer items-center gap-1.5 text-[0.85rem] text-white/75">
              <input
                type="checkbox"
                checked={course.constraints.includes(constraint)}
                {disabled}
                onchange={() => toggleConstraint(course, constraint)}
              />
              {constraint}
            </label>
          {/each}
        </div>
      </div>

      <div class="mt-3">
        <div class="mb-1 flex items-center gap-2">
          <span class="text-[0.8rem] text-white/60">{m["editor.course_trophy"]()}</span>
          <button
            class="{smallButton} ml-auto"
            type="button"
            {disabled}
            onclick={() => addTrophy(course)}
          >
            {m["editor.course_trophy_add"]()}
          </button>
        </div>
        {#if course.trophies.length > 0}
          <div class="flex flex-col gap-2">
            {#each course.trophies as trophy, ti (ti)}
              <div class="flex items-center gap-2">
                <input
                  class="{inputClass} max-w-44 flex-1"
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
                  class="{inputClass} max-w-28"
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
                  class="{inputClass} max-w-28"
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
                  class={trashButtonClass}
                  type="button"
                  {disabled}
                  title={m["editor.course_trophy_remove"]()}
                  aria-label={m["editor.course_trophy_remove"]()}
                  onclick={() => removeTrophy(course, ti)}
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
          <p class="text-[0.85rem] text-white/45">{m["editor.course_trophy_empty"]()}</p>
        {/if}
      </div>

      <div class="mt-3">
        <div class="mb-1 flex flex-wrap items-center gap-2">
          <span class="text-[0.8rem] text-white/60">{m["editor.course_charts"]()}</span>
          <span class="text-[0.78rem] text-white/40">{m["editor.course_charts_hint"]()}</span>
          <div class="ml-auto flex gap-2">
            <button
              class={smallButton}
              type="button"
              {disabled}
              onclick={() => openPicker(groupIndex, courseIndex)}
            >
              {m["editor.course_chart_pick"]()}
            </button>
            <button
              class={smallButton}
              type="button"
              {disabled}
              onclick={() => addEmptyChart(course)}
            >
              {m["editor.course_chart_add"]()}
            </button>
          </div>
        </div>

        {#if pickerFor?.group === groupIndex && pickerFor.course === courseIndex}
          <div class="mb-2 rounded-lg border border-[#64b5f6]/40 bg-[#64b5f6]/10 p-2">
            <div class="mb-2 flex items-center gap-2">
              <input
                class="{inputClass} flex-1"
                type="text"
                bind:value={pickerQuery}
                placeholder={m["editor.course_picker_search"]()}
                {disabled}
              />
              <button class={smallButton} type="button" onclick={() => (pickerFor = null)}>
                {m["common.cancel"]()}
              </button>
            </div>
            {#if pickerResults.length === 0}
              <p class="text-[0.85rem] text-white/50">{m["editor.course_picker_empty"]()}</p>
            {:else}
              <ul class="max-h-64 overflow-auto">
                {#each pickerResults as index (index)}
                  {@const entry = entries[index] ?? {}}
                  {@const info = describe(entry)}
                  <li class="flex items-center gap-2 border-b border-white/5 py-1 last:border-b-0">
                    <span class="min-w-0 flex-1 truncate text-[0.85rem] text-white/80">
                      {info.label}
                    </span>
                    <span class="hidden font-mono text-[0.75rem] text-white/40 sm:inline">
                      {info.hash.slice(0, 12)}…
                    </span>
                    <button
                      class={smallButton}
                      type="button"
                      {disabled}
                      onclick={() => {
                        const target = pickerCourse();
                        if (target !== null) addFromPicker(target, entry);
                      }}
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
            {#each course.charts as chart, chi (chi)}
              {@const issue = courseHashIssue(chart)}
              {@const resolved = courseChartResolvedIn(knownHashes, chart)}
              <div class="rounded-lg border border-white/10 bg-black/10 p-2">
                <div class="flex flex-wrap items-center gap-2">
                  <input
                    class="{inputClass} min-w-52 flex-1 {issue === 'md5'
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
                    class="{inputClass} min-w-52 flex-[1.4] {issue === 'sha256'
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
                    class="{inputClass} max-w-24"
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
                  <span class="text-[0.78rem] {resolved ? 'text-[#4caf50]' : 'text-amber-300'}">
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
                      class={iconButtonClass}
                      type="button"
                      {disabled}
                      title={m["editor.level_order_move_up"]()}
                      aria-label={m["editor.level_order_move_up"]()}
                      onclick={() => moveChart(course, chi, -1)}
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
                      class={iconButtonClass}
                      type="button"
                      {disabled}
                      title={m["editor.level_order_move_down"]()}
                      aria-label={m["editor.level_order_move_down"]()}
                      onclick={() => moveChart(course, chi, 1)}
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
                      class={trashButtonClass}
                      type="button"
                      {disabled}
                      title={m["editor.course_chart_remove"]()}
                      aria-label={m["editor.course_chart_remove"]()}
                      onclick={() => removeChart(course, chi)}
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
          <p class="text-[0.85rem] text-white/45">{m["editor.course_charts_empty"]()}</p>
        {/if}
      </div>

      {#if Object.keys(course.extra).length > 0}
        <details class="mt-2 rounded-md border border-white/10 p-2">
          <summary class="cursor-pointer text-[0.78rem] text-white/45">
            {m["editor.course_extra"]()}
          </summary>
          <pre
            class="mt-1 max-h-40 overflow-auto font-mono text-[0.75rem] whitespace-pre-wrap text-white/60">{JSON.stringify(
              course.extra,
              null,
              2
            )}</pre>
        </details>
      {/if}
    </div>
  {/snippet}

  <datalist id="editor-trophy-names">
    {#each TROPHY_NAMES as name (name)}
      <option value={name}></option>
    {/each}
  </datalist>

  {#if model.shape === "nested"}
    <div class="flex flex-col gap-3">
      {#each model.groups as group, groupIndex (groupIndex)}
        <div class="rounded-lg border border-white/20 p-2">
          <div class="mb-2 flex items-center gap-2">
            <span class="text-[0.85rem] text-white/70">
              {m["editor.course_group"]({ index: groupIndex + 1 })}
            </span>
            <button
              class="{trashButtonClass} ml-auto"
              type="button"
              {disabled}
              title={m["editor.course_group_remove"]()}
              aria-label={m["editor.course_group_remove"]()}
              onclick={() => {
                model = removeGroupFromModel(model, groupIndex);
                pickerFor = null;
                notify();
              }}
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
          <div class="flex flex-col gap-3">
            {#each group.courses as course, courseIndex (courseIndex)}
              {@render courseCard(course, groupIndex, courseIndex)}
            {/each}
            {#if group.courses.length === 0}
              <p class="text-[0.85rem] text-white/45">{m["editor.course_group_empty"]()}</p>
            {/if}
          </div>
          <div class="mt-2">
            <button
              class={smallButton}
              type="button"
              {disabled}
              onclick={() => {
                model = addCourseToModel(model);
                notify();
              }}
            >
              {m["editor.course_add"]()}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      {#each model.groups[0]?.courses ?? [] as course, courseIndex (courseIndex)}
        {@render courseCard(course, 0, courseIndex)}
      {/each}
      {#if (model.groups[0]?.courses.length ?? 0) === 0}
        <p class="text-[0.85rem] text-white/45">{m["editor.course_empty"]()}</p>
      {/if}
    </div>
  {/if}
</section>
