<script module lang="ts">
  /** 目录分区项。 */
  export interface EditTocSection {
    id: string;
    title: string;
  }

  /** 目录等级子项（count 为当前条目数，勾选状态由页面持有）。 */
  export interface EditTocLevel {
    level: string;
    unassigned: boolean;
    count: number;
  }
</script>

<script lang="ts">
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import FloatingPanel from "$lib/components/ui/FloatingPanel.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { entryGroupAnchorId } from "$lib/utils/table-editor";

  /**
   * 编辑态悬浮目录：分区锚点加“条目”下的等级子项。子项文字点击滚动到对应
   * 分组（组被筛选隐藏时回落条目区顶部），复选框切换多选并集筛选；目录与
   * 条目表共用 entryGroupAnchorId 的锚点命名。
   */
  interface Props {
    sections: EditTocSection[];
    levels: EditTocLevel[];
    selectedLevels: ReadonlySet<string>;
    includeUnassigned: boolean;
    onToggleLevel: (level: string, checked: boolean) => void;
    onToggleUnassigned: (checked: boolean) => void;
  }

  let {
    sections,
    levels,
    selectedLevels,
    includeUnassigned,
    onToggleLevel,
    onToggleUnassigned,
  }: Props = $props();

  function scrollToId(id: string): void {
    const element = document.getElementById(id);
    if (element === null) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  }

  function scrollToGroup(level: string, unassigned: boolean): void {
    const id = entryGroupAnchorId(level, unassigned);
    // 被筛选隐藏的组不在 DOM 里：回落到条目分区，仍有反馈
    scrollToId(document.getElementById(id) === null ? "charts-list" : id);
  }
</script>

<FloatingPanel
  sessionKey="miyakomeow_table_edit_toc_seen"
  initiallyOpen={false}
  position="top-right"
  size="medium"
  ariaLabel={m["toc.title"]()}
>
  <div class="mb-3 flex items-center justify-between gap-3">
    <div class="text-[0.95rem] font-semibold text-white/90">{m["toc.title"]()}</div>
    <div class="text-[0.8rem] text-white/60">{sections.length + levels.length}</div>
  </div>

  <nav class="max-h-[calc(60vh-3rem)] overflow-auto pr-1">
    {#each sections as section (section.id)}
      <button
        class="block w-full rounded-lg px-3 py-2 text-left text-[0.9rem] leading-snug text-white/85 transition-colors hover:bg-white/8 hover:text-white"
        type="button"
        onclick={() => scrollToId(section.id)}
      >
        {section.title}
      </button>
    {/each}

    {#if levels.length > 0}
      <div class="mt-2 border-t border-white/10 pt-2">
        <div class="px-3 pb-1 text-[0.8rem] text-white/45">
          {m["editor.entries_filter_level"]()}
        </div>
        {#each levels as group (group.unassigned ? "__unassigned__" : group.level)}
          <div class="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white/8">
            <Checkbox
              size="sm"
              checked={group.unassigned ? includeUnassigned : selectedLevels.has(group.level)}
              ariaLabel={group.unassigned ? m["editor.entries_filter_unassigned"]() : group.level}
              onchange={(checked: boolean) =>
                group.unassigned
                  ? onToggleUnassigned(checked)
                  : onToggleLevel(group.level, checked)}
            />
            <button
              class="min-w-0 flex-1 truncate text-left text-[0.85rem] text-white/75 transition-colors hover:text-white"
              type="button"
              onclick={() => scrollToGroup(group.level, group.unassigned)}
            >
              {group.unassigned ? m["editor.entries_filter_unassigned"]() : group.level}
            </button>
            <span class="text-[0.75rem] text-white/40">{group.count}</span>
          </div>
        {/each}
      </div>
    {/if}
  </nav>
</FloatingPanel>
