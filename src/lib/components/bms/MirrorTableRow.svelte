<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";
  import { mirrorTablePath } from "@brightmeows/mirror/urls";

  import MirrorTableEditRow from "./MirrorTableEditRow.svelte";

  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import GradientButton from "$lib/components/ui/GradientButton.svelte";
  import { jsonPreview } from "$lib/components/ui/JsonPreview.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { MirrorAdminUi } from "$lib/types/bms";
  import type { JsonPreviewHandle } from "$lib/types/ui";
  import { clipboardFieldFeedback } from "$lib/utils/clipboard.svelte";
  import { tableLabelOf } from "$lib/utils/mirror-tables";

  interface Props {
    item: MirrorTableItem;
    selected: boolean;
    onchange: (checked: boolean) => void;
    adminUi: MirrorAdminUi;
    /** 是否渲染行尾操作列（管理员或已登录用户）。 */
    showActions: boolean;
    /** 是否能执行删除（已登录）；管理员删除在编辑卡片内，贡献者在行尾。 */
    canDelete?: boolean;
    mirrorPreview?: JsonPreviewHandle | undefined;
    /** 删除进行中：按钮禁用。 */
    deleting?: boolean;
    ondelete?: ((item: MirrorTableItem) => void) | undefined;
  }

  let {
    item,
    selected,
    onchange,
    adminUi,
    showActions,
    canDelete = false,
    mirrorPreview,
    deleting = false,
    ondelete,
  }: Props = $props();

  let cb = clipboardFieldFeedback();

  const isExpanded = $derived(adminUi.expandedUrl === item.url);
  const columnCount = $derived(showActions ? 7 : 6);
  const authTitle = $derived(
    item.protected === true ? m["mirror.protected_title"]() : m["mirror.unprotected_title"]()
  );
  const authActionTitle = $derived(m["mirror.auth_icon_action"]({ status: authTitle }));
  const deleteLabel = $derived(
    deleting ? m["mirror.deleting"]() : m["mirror.delete_aria"]({ name: tableLabelOf(item) })
  );
  const iconButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
  const trashButtonClass =
    "flex size-7 cursor-pointer items-center justify-center rounded-md text-red-200/80 transition-colors duration-200 hover:bg-red-400/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";
</script>

<tr class="hover:bg-white/5 last:[&>td]:border-b-0">
  <td class="table-td-glass wrap-break-word">
    <Checkbox checked={selected} onchange={(v: boolean) => onchange(v)} />
  </td>
  <td class="table-td-glass wrap-break-word">
    {item.symbol ?? ""}
  </td>
  <td class="table-td-glass min-w-50 wrap-break-word">
    <strong
      class="cursor-default"
      use:jsonPreview={{
        preview: mirrorPreview,
        options: {
          value: item,
          label: `${item.name ?? m["mirror.default_name"]()} JSON`,
          maxHeightRem: 14,
        },
      }}
    >
      {item.name}
    </strong>
  </td>
  <td class="table-td-glass px-2">
    {#if adminUi.isAdmin}
      <button
        class={iconButtonClass}
        type="button"
        title={authActionTitle}
        aria-label={authActionTitle}
        onclick={() => adminUi.openEdit(item)}
      >
        {#if item.protected === true}
          <svg
            class="size-4 text-success"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        {:else}
          <svg
            class="size-4 text-[#ffd54f]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        {/if}
      </button>
    {:else}
      <span
        class="flex size-7 items-center justify-center"
        title={authTitle}
        role="img"
        aria-label={authTitle}
      >
        {#if item.protected === true}
          <svg
            class="size-4 text-success"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        {:else}
          <svg
            class="size-4 text-[#ffd54f]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        {/if}
      </span>
    {/if}
  </td>
  <td class="table-td-glass min-w-32.5 wrap-break-word">
    <div class="flex items-center gap-1">
      <GradientButton
        variant="blue"
        href={item.dir_name ? mirrorTablePath(item.dir_name) : item.url}
        size="sm"
        class="flex min-w-0 flex-1"
        target="_blank"
        rel="noopener noreferrer"
      >
        {m["mirror.mirror_link"]()}
      </GradientButton>
      {#if cb.copiedField === "mirror"}
        <span class="badge-copied">{m["common.copied_bang"]()}</span>
      {:else}
        <button
          class="flex-none cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white"
          onclick={() => cb.copy("mirror", new URL(item.url, window.location.origin).toString())}
          aria-label={m["mirror.copy_mirror_aria"]()}
        >
          {m["common.copy"]()}
        </button>
      {/if}
    </div>
  </td>
  <td class="table-td-glass min-w-32.5 wrap-break-word">
    {#if item.url_from}
      <div class="flex items-center gap-1">
        <GradientButton
          variant="orange"
          href={item.url_from}
          size="sm"
          class="flex min-w-0 flex-1"
          target="_blank"
          rel="noopener noreferrer"
        >
          {m["mirror.original_link"]()}
        </GradientButton>
        {#if cb.copiedField === "original"}
          <span class="badge-copied">{m["common.copied_bang"]()}</span>
        {:else}
          <button
            class="flex-none cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white"
            onclick={() => cb.copy("original", item.url_from!)}
            aria-label={m["mirror.copy_original_aria"]()}
          >
            {m["common.copy"]()}
          </button>
        {/if}
      </div>
    {:else}
      <span class="text-white/50">{m["common.none"]()}</span>
    {/if}
  </td>
  {#if showActions}
    <td class="table-td-glass px-2">
      <div class="flex items-center gap-1">
        {#if adminUi.isAdmin}
          <button
            class={iconButtonClass}
            type="button"
            title={m["mirror.edit_table_title"]()}
            aria-label={m["mirror.edit_table_title"]()}
            aria-expanded={isExpanded}
            onclick={() => adminUi.toggleEdit(item)}
          >
            <svg
              class="size-4 text-white/70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        {:else if canDelete && item.protected !== true && ondelete}
          <button
            class={trashButtonClass}
            type="button"
            title={deleteLabel}
            aria-label={deleteLabel}
            disabled={deleting}
            onclick={() => ondelete(item)}
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
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
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

{#if adminUi.isAdmin && isExpanded}
  {#if adminUi.overviewState === "idle" || adminUi.overviewState === "loading"}
    <tr class="bg-black/30 last:[&>td]:border-b-0">
      <td colspan={columnCount} class="table-td-glass text-[0.9rem] text-white/60">
        {m["mirror.loading_override"]()}
      </td>
    </tr>
  {:else}
    <MirrorTableEditRow
      {item}
      colCount={columnCount}
      override={adminUi.overrideOf(item)}
      busy={adminUi.busy}
      {canDelete}
      {deleting}
      tag1Options={adminUi.tag1Options}
      tag2Options={adminUi.tag2Options}
      nextTagOrder={adminUi.nextTagOrder}
      onauthorize={(item2: MirrorTableItem) => adminUi.authorize(item2)}
      ondisable={(note: string) => adminUi.disable(item, note)}
      onmetasave={(fields) => adminUi.saveMeta(item, fields)}
      onmetaclear={() => adminUi.clearMeta(item)}
      {ondelete}
      oncollapse={() => adminUi.toggleEdit(item)}
    />
  {/if}
{/if}
