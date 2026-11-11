<script lang="ts">
  import {
    addCourseToGroup,
    addGroupToModel,
    moveCourseInModel,
    moveCourseToIndex,
    removeCourseFromModel,
    removeGroupFromModel,
    type CourseModel,
    type EditableCourse,
  } from "@brightmeows/bms/course";
  import type { Course, ResolvedCourseGroup } from "@brightmeows/bms/format";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import CourseRowEdit from "./CourseRowEdit.svelte";
  import CourseRowView from "./CourseRowView.svelte";

  import InlineEmpty from "#lib/components/ui/InlineEmpty.svelte";
  import { btnGhost, btnIconDanger } from "#lib/constants/ui-classes.js";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import { m } from "#lib/paraglide/messages.js";
  import { createDragList } from "#lib/utils/ui/dnd-list.svelte.js";

  /**
   * 段位内容：查看态与编辑态共用组遍历、组标题与全宽课程行；卡片显隐由页面管理。
   * 查看态严格只读；编辑态在行内展开表单，一次只展开一行。
   */
  interface Props {
    editing: boolean;
    groups?: ResolvedCourseGroup[];
    model?: CourseModel;
    entries?: Record<string, unknown>[];
    symbol?: string;
    /** 查看态缺少模型形状时由页面传入；编辑态自动取 model.shape。 */
    nested?: boolean | undefined;
    disabled?: boolean;
    onChange?: (() => void) | undefined;
    /** 删除类撤销通知的出口（dock notice 区渲染撤销按钮）；缺省不通知。 */
    onNotice?: ((notice: EditorNotice) => void) | undefined;
  }

  let {
    editing,
    groups = [],
    model = $bindable(undefined),
    entries = [],
    symbol = "",
    nested = undefined,
    disabled = false,
    onChange,
    onNotice = undefined,
  }: Props = $props();

  interface ViewCourseItem {
    kind: "view";
    course: Course;
    key: string;
    courseIndex: number;
  }

  interface EditCourseItem {
    kind: "edit";
    course: EditableCourse;
    key: string;
    courseIndex: number;
  }

  type CourseItem = ViewCourseItem | EditCourseItem;

  interface DisplayGroup {
    key: string;
    groupIndex: number;
    items: CourseItem[];
  }

  const courseKeys = new WeakMap<EditableCourse, number>();
  let nextCourseKey = 1;
  let expandedKey = $state<string | null>(null);
  let pendingExpand = $state<{ groupIndex: number; courseIndex: number } | null>(null);

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

  const displayGroups = $derived.by<DisplayGroup[]>(() => {
    if (editing) {
      if (model === undefined) return [];
      return model.groups.map((group, groupIndex) => ({
        key: `group:${groupIndex}`,
        groupIndex,
        items: group.courses.map((course, courseIndex) => ({
          kind: "edit" as const,
          course,
          key: editKey(course),
          courseIndex,
        })),
      }));
    }

    return groups.map((group, groupIndex) => ({
      key: `group:${groupIndex}`,
      groupIndex,
      items: group.map((course, courseIndex) => ({
        kind: "view" as const,
        course,
        key: viewKey(groupIndex, courseIndex),
        courseIndex,
      })),
    }));
  });

  const showGroups = $derived(nested ?? (editing ? model?.shape === "nested" : groups.length > 1));

  /** 组前课程数前缀和：行内课程下标换算全局扁平下标（拖拽行标识）。 */
  const groupOffsets = $derived.by(() => {
    const offsets: number[] = [];
    let acc = 0;
    if (editing && model !== undefined) {
      for (const group of model.groups) {
        offsets.push(acc);
        acc += group.courses.length;
      }
    } else {
      for (const group of groups) {
        offsets.push(acc);
        acc += group.length;
      }
    }
    return offsets;
  });

  /** 扁平下标到组与组内位置的映射；拖拽限定同组换位。 */
  const coursePositions = $derived.by(() => {
    const map = new Map<number, { groupIndex: number; courseIndex: number }>();
    let flat = 0;
    if (editing && model !== undefined) {
      model.groups.forEach((group, groupIndex) => {
        group.courses.forEach((_, courseIndex) => {
          map.set(flat, { groupIndex, courseIndex });
          flat += 1;
        });
      });
    }
    return map;
  });

  const dnd = createDragList({
    enabled: () => editing && !disabled,
    canDrop: (from, to) => {
      const source = coursePositions.get(from);
      const target = coursePositions.get(to);
      return (
        source !== undefined && target !== undefined && source.groupIndex === target.groupIndex
      );
    },
    onMove: (from, to) => {
      const source = coursePositions.get(from);
      const target = coursePositions.get(to);
      if (
        model === undefined ||
        source === undefined ||
        target === undefined ||
        source.groupIndex !== target.groupIndex
      ) {
        return;
      }
      model = moveCourseToIndex(model, source.groupIndex, source.courseIndex, target.courseIndex);
      onChange?.();
    },
  });

  function toggle(key: string): void {
    expandedKey = expandedKey === key ? null : key;
  }

  $effect(() => {
    if (pendingExpand === null || model === undefined) return;
    const course = model.groups[pendingExpand.groupIndex]?.courses[pendingExpand.courseIndex];
    if (course !== undefined) expandedKey = editKey(course);
    pendingExpand = null;
  });

  $effect(() => {
    if (!editing) expandedKey = null;
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
    const snapshot = model;
    const key = editKey(course);
    model = removeCourseFromModel(model, groupIndex, courseIndex);
    if (expandedKey === key) expandedKey = null;
    onChange?.();
    onNotice?.({
      kind: "ok",
      text: m["editor.undo_course_deleted"]({ name }),
      action: {
        label: m["common.undo"](),
        run: () => {
          model = snapshot;
          onChange?.();
        },
      },
    });
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
    const snapshot = model;
    const courseCount = group.courses.length;
    model = removeGroupFromModel(model, groupIndex);
    expandedKey = null;
    onChange?.();
    onNotice?.({
      kind: "ok",
      text: m["editor.undo_group_deleted"]({ index: groupIndex + 1, count: courseCount }),
      action: {
        label: m["common.undo"](),
        run: () => {
          model = snapshot;
          onChange?.();
        },
      },
    });
  }
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[0.85rem] text-white-50">{m["editor.course_hint"]()}</span>
      {#if editing}
        <div class="ml-auto flex flex-wrap gap-2">
          {#if showGroups}
            <button class={btnGhost} type="button" {disabled} onclick={addGroup}>
              <Plus class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.course_group_add"]()}
            </button>
          {:else}
            <button class={btnGhost} type="button" {disabled} onclick={() => addCourse(0)}>
              <Plus class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.course_add"]()}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if displayGroups.length === 0}
      <InlineEmpty text={m["editor.course_empty"]()} />
    {:else}
      {#each displayGroups as group (group.key)}
        <section class="flex flex-col gap-2">
          {#if showGroups}
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-[1rem] font-semibold text-white-90">
                {m["editor.course_group"]({ index: group.groupIndex + 1 })}
              </h3>
              <span class="text-[0.8rem] text-white-50">
                {m["course.course_count"]({ count: group.items.length })}
              </span>
              {#if editing}
                <div class="ml-auto flex flex-wrap gap-2">
                  <button
                    class={btnGhost}
                    type="button"
                    {disabled}
                    onclick={() => addCourse(group.groupIndex)}
                  >
                    <Plus class="size-4 shrink-0" aria-hidden="true" />
                    {m["editor.course_add"]()}
                  </button>
                  <button
                    class={btnIconDanger}
                    type="button"
                    {disabled}
                    title={m["editor.course_group_remove"]()}
                    aria-label={m["editor.course_group_remove"]()}
                    onclick={() => removeGroup(group.groupIndex)}
                  >
                    <Trash2 class="size-4" aria-hidden="true" />
                  </button>
                </div>
              {/if}
            </div>
          {/if}

          <div class="flex flex-col">
            {#each group.items as item (item.key)}
              {#if item.kind === "view"}
                <CourseRowView
                  course={item.course}
                  {symbol}
                  expanded={expandedKey === item.key}
                  onToggle={() => toggle(item.key)}
                />
              {:else}
                {@const flatIndex = (groupOffsets[group.groupIndex] ?? 0) + item.courseIndex}
                <CourseRowEdit
                  course={item.course}
                  {entries}
                  {disabled}
                  expanded={expandedKey === item.key}
                  canMoveUp={item.courseIndex > 0}
                  canMoveDown={item.courseIndex < group.items.length - 1}
                  dragItem={dnd.item}
                  dragIndex={flatIndex}
                  dragDropTargetIndex={dnd.dropTargetIndex}
                  onToggle={() => toggle(item.key)}
                  onDelete={() => removeCourse(group.groupIndex, item.courseIndex)}
                  onMoveUp={() => moveCourse(group.groupIndex, item.courseIndex, -1)}
                  onMoveDown={() => moveCourse(group.groupIndex, item.courseIndex, 1)}
                  {onNotice}
                  onedit={(mutate) => {
                    mutate(item.course);
                    onChange?.();
                  }}
                />
              {/if}
            {/each}
            {#if group.items.length === 0}
              <InlineEmpty
                text={showGroups ? m["editor.course_group_empty"]() : m["editor.course_empty"]()}
              />
            {/if}
          </div>
        </section>
      {/each}
    {/if}
  </div>
</div>
