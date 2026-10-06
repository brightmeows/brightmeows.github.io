<script lang="ts">
  import type { SharedTableItem } from "@brightmeows/mirror/shared";

  import { btnIconDanger, btnIconPlain } from "$lib/constants/ui-classes";
  import { m } from "$lib/paraglide/messages.js";

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
    deleting ? m["shared.deleting"]() : m["shared.delete_aria"]({ name: label })
  );
  const editLabel = $derived(m["shared.edit_aria"]({ name: label }));

  function formatUpdatedAt(value: string): string {
    const at = Date.parse(value);
    if (!Number.isFinite(at)) return value;
    return new Date(at).toLocaleString();
  }
</script>

<tr class="hover:bg-white-5 last:[&>td]:border-b-0">
  <td class="table-td-glass wrap-break-word text-white-80">{item.symbol ?? ""}</td>
  <td class="table-td-glass min-w-50 wrap-break-word">
    <a href={item.url} class="text-accent no-underline transition-colors hover:text-accent-light">
      {label}
    </a>
    <div class="mt-0.5 font-mono text-[0.8rem] text-white-45">{item.id}</div>
  </td>
  <td class="table-td-glass wrap-break-word text-white-70">
    {m["shared.entries_count"]({ count: item.entries })}
  </td>
  <td class="table-td-glass wrap-break-word whitespace-nowrap text-white-60">
    {formatUpdatedAt(item.updated_at)}
  </td>
  {#if canEdit || canDelete}
    <td class="table-td-glass px-2">
      <div class="flex items-center justify-center gap-1">
        {#if canEdit}
          <a
            class={btnIconPlain}
            href={`${item.url}edit/`}
            title={editLabel}
            aria-label={editLabel}
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
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
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
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        {/if}
      </div>
    </td>
  {/if}
</tr>
