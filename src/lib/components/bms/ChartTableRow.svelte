<script lang="ts">
  import type { ChartData } from "@brightmeows/bms/format";

  import ChartLinkButtons from "./ChartLinkButtons.svelte";
  import DragHandle from "./DragHandle.svelte";
  import RowActionMenu from "./RowActionMenu.svelte";

  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import { jsonPreview } from "#lib/components/ui/JsonPreview.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { JsonPreviewHandle } from "#lib/types/ui.js";
  import { inertDragItem, type DragList } from "#lib/utils/ui/dnd-list.svelte.js";

  /** 行拖拽上下文：列表实例（把手用 handle）、本行排序下标与禁拖标志。 */
  interface RowDrag {
    dnd: DragList;
    index: number;
    disabled: boolean;
  }

  interface Props {
    chart: ChartData;
    groupLevel: string;
    bundleUrl: string | undefined;
    diffUrl: string | undefined;
    chartPreview: JsonPreviewHandle | undefined;
    /** 编辑态：在行首显示勾选框。 */
    selectable?: boolean;
    selected?: boolean;
    disabled?: boolean;
    /** 编辑态：组内拖拽排序上下文；查看态不传。 */
    drag?: RowDrag | undefined;
    onSelect?: ((checked: boolean) => void) | undefined;
    /** 编辑态：标题列内的编辑入口。 */
    onEdit?: (() => void) | undefined;
    /** 编辑态：未指派条目的文件等级建议。 */
    levelHint?: string | null;
    /** 编辑态菜单：组内是否可上移/下移与移动回调。 */
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onMoveUp?: (() => void) | undefined;
    onMoveDown?: (() => void) | undefined;
    /** 供块窗口表格标注 1-based 行号，普通表格不传。 */
    ariaRowIndex?: number | undefined;
    /** 供新增条目后定位的行 id，普通表格不传。 */
    rowId?: string | undefined;
    /** 搜索的扁平结果里在标题前显示等级标签。 */
    showLevel?: boolean;
  }

  let {
    chart,
    groupLevel,
    bundleUrl,
    diffUrl,
    chartPreview,
    selectable = false,
    selected = false,
    disabled = false,
    drag = undefined,
    onSelect,
    onEdit,
    levelHint = null,
    canMoveUp = false,
    canMoveDown = false,
    onMoveUp = undefined,
    onMoveDown = undefined,
    ariaRowIndex = undefined,
    rowId = undefined,
    showLevel = false,
  }: Props = $props();

  const rowAction = $derived(drag === undefined ? inertDragItem : drag.dnd.item);
  const rowParams = $derived(
    drag === undefined
      ? { index: -1, disabled: true }
      : { index: drag.index, disabled: drag.disabled }
  );
</script>

<tr use:rowAction={rowParams} id={rowId} aria-rowindex={ariaRowIndex} class="hover:bg-white-5">
  {#if selectable}
    <td class="table-td-compact px-2">
      <div class="flex items-center justify-center gap-1">
        {#if drag}
          <DragHandle
            dnd={drag.dnd}
            index={drag.index}
            name={chart.title ?? m["common.unknown_title"]()}
            {disabled}
          />
        {/if}
        <Checkbox
          size="sm"
          checked={selected}
          {disabled}
          ariaLabel={m["editor.entries.select_row"]()}
          onchange={(checked: boolean) => onSelect?.(checked)}
        />
      </div>
    </td>
  {/if}
  <td class="table-td-compact whitespace-nowrap">
    <div class="flex min-w-0 justify-center">
      <ChartLinkButtons {chart} {bundleUrl} {diffUrl} />
    </div>
  </td>
  <th
    scope="row"
    class="table-th-row-sticky table-td-compact text-left font-normal wrap-break-word"
  >
    {#if showLevel}
      <span class="mr-1.5 rounded-glass-sm bg-white-10 px-1.5 py-0.5 text-[0.75rem] text-white-70">
        {groupLevel}
      </span>
    {/if}
    <strong
      use:jsonPreview={{
        preview: chartPreview,
        trigger: "contextmenu",
        options: {
          value: { ...chart, groupLevel },
          label: m["common.chart_json"](),
          maxHeightRem: 14,
        },
      }}
    >
      {chart.title ?? m["common.unknown_title"]()}
    </strong>
    {#if onEdit}
      <button
        class="link-accent ml-2 text-[0.8rem] whitespace-nowrap"
        type="button"
        title={m["editor.entry.edit"]()}
        aria-label={m["editor.entry.edit_title"]()}
        onclick={onEdit}
      >
        {m["editor.entry.edit_short"]()}
      </button>
    {/if}
    {#if levelHint}
      <div class="mt-1 text-[0.75rem] text-white-40">{levelHint}</div>
    {/if}
  </th>
  <td class="table-td-compact wrap-break-word">
    {chart.artist ?? m["common.unknown_artist"]()}
  </td>
  <td class="table-td-compact wrap-break-word">
    {chart.comment ?? ""}
  </td>
  {#if drag !== undefined && onMoveUp !== undefined && onMoveDown !== undefined}
    <td class="table-td-compact w-10 px-1 text-center">
      <RowActionMenu
        {disabled}
        items={[
          {
            label: m["editor.level.order_move_up"](),
            disabled: disabled || !canMoveUp,
            onselect: onMoveUp,
          },
          {
            label: m["editor.level.order_move_down"](),
            disabled: disabled || !canMoveDown,
            onselect: onMoveDown,
          },
        ]}
      />
    </td>
  {/if}
</tr>
