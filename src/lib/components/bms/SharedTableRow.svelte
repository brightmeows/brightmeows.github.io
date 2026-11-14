<script lang="ts">
  import type { SharedTableItem } from "@brightmeows/mirror/shared";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { btnIconDanger, btnIconPlain, linkInline } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { formatRelativeTime } from "#lib/utils/infra/date.js";

  interface Props {
    item: SharedTableItem;
    /** 是否显示编辑入口（作者）。 */
    canEdit: boolean;
    /** 是否显示删除入口（作者或管理员）。 */
    canDelete: boolean;
    /** 删除进行中：按钮禁用。 */
    deleting?: boolean;
    ondelete?: ((item: SharedTableItem) => void) | undefined;
  }

  let { item, canEdit, canDelete, deleting = false, ondelete }: Props = $props();

  const label = $derived(item.name !== "" ? item.name : item.id);
  const deleteLabel = $derived(
    deleting ? m["shared.delete.progress"]() : m["shared.delete.aria"]({ name: label })
  );
  const editLabel = $derived(m["shared.detail.edit_aria"]({ name: label }));

  function formatUpdatedAt(value: string): string {
    return formatRelativeTime(value, getLocale());
  }
</script>

<tr class="hover:bg-white-5 last:[&>td]:border-b-0">
  <th
    scope="row"
    class="table-th-row-sticky table-td-glass text-left font-normal wrap-break-word text-white-80"
    >{item.symbol ?? ""}</th
  >
  <td class="table-td-glass min-w-50 wrap-break-word">
    <a href={item.url} class={linkInline}>
      {label}
    </a>
    <div class="mt-0.5 font-mono text-[0.8rem] text-white-50">{item.id}</div>
  </td>
  <td class="table-td-glass wrap-break-word text-white-70">
    {m["shared.detail.entries"]({ count: item.entries })}
  </td>
  <td class="table-td-glass wrap-break-word whitespace-nowrap text-white-60">
    <span title={item.updated_at}>{formatUpdatedAt(item.updated_at)}</span>
  </td>
  {#if canEdit || canDelete}
    <td class="table-td-glass px-2">
      <div class="flex items-center justify-center gap-1">
        {#if canEdit}
          <a
            class={btnIconPlain}
            href={`${item.url}?edit=1`}
            title={editLabel}
            aria-label={editLabel}
          >
            <Pencil class="size-4" aria-hidden="true" />
          </a>
        {/if}
        {#if canDelete}
          <button
            class={btnIconDanger}
            type="button"
            title={deleteLabel}
            aria-label={deleteLabel}
            disabled={deleting}
            onclick={() => ondelete?.(item)}
          >
            <Trash2 class="size-4" aria-hidden="true" />
          </button>
        {/if}
      </div>
    </td>
  {/if}
</tr>
