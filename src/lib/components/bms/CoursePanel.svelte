<script lang="ts">
  import {
    addCourseToGroup,
    addGroupToModel,
    moveCourseInModel,
    removeCourseFromModel,
    removeGroupFromModel,
    type CourseModel,
    type EditableCourse,
  } from "@brightmeows/bms/course";
  import type { ResolvedCourseGroup } from "@brightmeows/bms/format";

  import CourseRowEdit from "./CourseRowEdit.svelte";
  import CourseRowView from "./CourseRowView.svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import { btnGhost, btnIconDanger } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 段位面板：查看态与编辑态共用组标题与全宽课程行。
   * 查看态严格只读；编辑态在行内展开表单，一次只展开一行。
   */
  interface Props {
    id?: string | undefined;
    editing: boolean;
    groups?: ResolvedCourseGroup[];
    model?: CourseModel;
    entries?: Record<string, unknown>[];
    symbol?: string;
    /** 查看态缺少模型形状时由页面传入；编辑态自动取 model.shape。 */
    nested?: boolean | undefined;
    disabled?: boolean;
    initiallyCollapsed?: boolean;
    onChange?: (() => void) | undefined;
  }

  let {
    id = undefined,
    editing,
    groups = [],
    model = $bindable(undefined),
    entries = [],
    symbol = "",
    nested = undefined,
    disabled = false,
    initiallyCollapsed = true,
    onChange,
  }: Props = $props();

  const courseKeys = new WeakMap<EditableCourse, number>();
  let nextCourseKey = 1;
  let expandedKey = $state<string | null>(null);
  let pendingExpand = $state<{ groupIndex: number; courseIndex: number } | null>(null);

  const showGroups = $derived(nested ?? (editing ? model?.shape === "nested" : groups.length > 1));
  const viewCourseCount = $derived(groups.reduce((total, group) => total + group.length, 0));
  const editCourseCount = $derived(
    model?.groups.reduce((total, group) => total + group.courses.length, 0) ?? 0
  );
  const courseCount = $derived(editing ? editCourseCount : viewCourseCount);
  const groupCount = $derived(editing ? (model?.groups.length ?? 0) : groups.length);
  const countsHint = $derived(
    showGroups
      ? m["course.counts"]({ groups: groupCount, courses: courseCount })
      : m["course.counts_flat"]({ courses: courseCount })
  );

  function keyFor(course: EditableCourse): number {
    let key = courseKeys.get(course);
    if (key === undefined) {
      key = nextCourseKey;
      nextCourseKey += 1;
      courseKeys.set(course, key);
    }
    return key;
  }

  function editKey(course: EditableCourse): string {
    return `edit:${keyFor(course)}`;
  }

  function viewKey(groupIndex: number, courseIndex: number): string {
    return `view:${groupIndex}:${courseIndex}`;
  }

  function toggle(key: string): void {
    expandedKey = expandedKey === key ? null : key;
  }

  $effect(() => {
    if (pendingExpand === null || model === undefined) return;
    const course = model.groups[pendingExpand.groupIndex]?.courses[pendingExpand.courseIndex];
    if (course !== undefined) expandedKey = editKey(course);
    pendingExpand = null;
  });

  function addGroup(): void {
    if (model === undefined) return;
    const next = addGroupToModel(model);
    pendingExpand = { groupIndex: next.groups.length - 1, courseIndex: 0 };
    model = next;
    onChange?.();
  }

  function addCourse(groupIndex: number): void {
    if (model === undefined) return;
    const next = addCourseToGroup(model, groupIndex);
    const group = next.groups[groupIndex];
    pendingExpand = {
      groupIndex,
      courseIndex: group === undefined ? 0 : group.courses.length - 1,
    };
    model = next;
    onChange?.();
  }

  function removeCourse(groupIndex: number, courseIndex: number): void {
    if (model === undefined) return;
    const course = model.groups[groupIndex]?.courses[courseIndex];
    if (course === undefined) return;
    const name = course.name.trim() || m["course.unnamed"]();
    if (!window.confirm(m["course.remove_confirm"]({ name }))) return;
    const key = editKey(course);
    model = removeCourseFromModel(model, groupIndex, courseIndex);
    if (expandedKey === key) expandedKey = null;
    onChange?.();
  }

  function moveCourse(groupIndex: number, courseIndex: number, delta: number): void {
    if (model === undefined) return;
    model = moveCourseInModel(model, groupIndex, courseIndex, delta);
    onChange?.();
  }

  function removeGroup(groupIndex: number): void {
    if (model === undefined) return;
    const group = model.groups[groupIndex];
    if (group === undefined) return;
    const confirmed = window.confirm(
      m["course.group_remove_confirm"]({ index: groupIndex + 1, count: group.courses.length })
    );
    if (!confirmed) return;
    model = removeGroupFromModel(model, groupIndex);
    expandedKey = null;
    onChange?.();
  }
</script>

<DetailsPanel
  {id}
  class="scroll-mt-20"
  summary={m["editor.course_section"]()}
  hint={countsHint}
  defaultOpen={!initiallyCollapsed}
>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[0.85rem] text-white-50">{m["editor.course_hint"]()}</span>
      {#if editing}
        <div class="ml-auto flex flex-wrap gap-2">
          {#if showGroups}
            <button class={btnGhost} type="button" {disabled} onclick={addGroup}>
              {m["editor.course_group_add"]()}
            </button>
          {:else}
            <button class={btnGhost} type="button" {disabled} onclick={() => addCourse(0)}>
              {m["editor.course_add"]()}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if editing}
      {#if model !== undefined}
        {#if showGroups}
          {#each model.groups as group, groupIndex (groupIndex)}
            <section class="flex flex-col gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-[1rem] font-semibold text-white-90">
                  {m["editor.course_group"]({ index: groupIndex + 1 })}
                </h3>
                <span class="text-[0.8rem] text-white-50">
                  {m["course.course_count"]({ count: group.courses.length })}
                </span>
                <div class="ml-auto flex flex-wrap gap-2">
                  <button
                    class={btnGhost}
                    type="button"
                    {disabled}
                    onclick={() => addCourse(groupIndex)}
                  >
                    {m["editor.course_add"]()}
                  </button>
                  <button
                    class={btnIconDanger}
                    type="button"
                    {disabled}
                    title={m["editor.course_group_remove"]()}
                    aria-label={m["editor.course_group_remove"]()}
                    onclick={() => removeGroup(groupIndex)}
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
              <div class="flex flex-col gap-2">
                {#each group.courses as course, courseIndex (keyFor(course))}
                  <CourseRowEdit
                    {course}
                    {entries}
                    {disabled}
                    expanded={expandedKey === editKey(course)}
                    canMoveUp={courseIndex > 0}
                    canMoveDown={courseIndex < group.courses.length - 1}
                    onToggle={() => toggle(editKey(course))}
                    onDelete={() => removeCourse(groupIndex, courseIndex)}
                    onMoveUp={() => moveCourse(groupIndex, courseIndex, -1)}
                    onMoveDown={() => moveCourse(groupIndex, courseIndex, 1)}
                    onChange={() => onChange?.()}
                  />
                {/each}
                {#if group.courses.length === 0}
                  <p class="text-[0.85rem] text-white-50">{m["editor.course_group_empty"]()}</p>
                {/if}
              </div>
            </section>
          {/each}
          {#if model.groups.length === 0}
            <p class="text-[0.85rem] text-white-50">{m["editor.course_empty"]()}</p>
          {/if}
        {:else}
          <div class="flex flex-col gap-2">
            {#each model.groups[0]?.courses ?? [] as course, courseIndex (keyFor(course))}
              <CourseRowEdit
                {course}
                {entries}
                {disabled}
                expanded={expandedKey === editKey(course)}
                canMoveUp={courseIndex > 0}
                canMoveDown={courseIndex < (model.groups[0]?.courses.length ?? 0) - 1}
                onToggle={() => toggle(editKey(course))}
                onDelete={() => removeCourse(0, courseIndex)}
                onMoveUp={() => moveCourse(0, courseIndex, -1)}
                onMoveDown={() => moveCourse(0, courseIndex, 1)}
                onChange={() => onChange?.()}
              />
            {/each}
            {#if (model.groups[0]?.courses.length ?? 0) === 0}
              <p class="text-[0.85rem] text-white-50">{m["editor.course_empty"]()}</p>
            {/if}
          </div>
        {/if}
      {/if}
    {:else}
      {#if showGroups}
        {#each groups as group, groupIndex (groupIndex)}
          <section class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-[1rem] font-semibold text-white-90">
                {m["editor.course_group"]({ index: groupIndex + 1 })}
              </h3>
              <span class="text-[0.8rem] text-white-50">
                {m["course.course_count"]({ count: group.length })}
              </span>
            </div>
            <div class="flex flex-col gap-2">
              {#each group as course, courseIndex (courseIndex)}
                <CourseRowView
                  {course}
                  {symbol}
                  expanded={expandedKey === viewKey(groupIndex, courseIndex)}
                  onToggle={() => toggle(viewKey(groupIndex, courseIndex))}
                />
              {/each}
              {#if group.length === 0}
                <p class="text-[0.85rem] text-white-50">{m["editor.course_group_empty"]()}</p>
              {/if}
            </div>
          </section>
        {/each}
        {#if groups.length === 0}
          <p class="text-[0.85rem] text-white-50">{m["editor.course_empty"]()}</p>
        {/if}
      {:else}
        <div class="flex flex-col gap-2">
          {#each groups[0] ?? [] as course, courseIndex (courseIndex)}
            <CourseRowView
              {course}
              {symbol}
              expanded={expandedKey === viewKey(0, courseIndex)}
              onToggle={() => toggle(viewKey(0, courseIndex))}
            />
          {/each}
          {#if (groups[0]?.length ?? 0) === 0}
            <p class="text-[0.85rem] text-white-50">{m["editor.course_empty"]()}</p>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</DetailsPanel>
