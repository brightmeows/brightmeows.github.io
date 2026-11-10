<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";
  import { mirrorTablePath } from "@brightmeows/mirror/urls";
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import MirrorTableEditRow from "./MirrorTableEditRow.svelte";

  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import GradientButton from "#lib/components/ui/GradientButton.svelte";
  import { jsonPreview } from "#lib/components/ui/JsonPreview.svelte";
  import ToggleButton from "#lib/components/ui/ToggleButton.svelte";
  import { btnDanger, btnGhostXs, btnIconPlain } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MirrorAdminUi } from "#lib/types/bms-view.js";
  import type { JsonPreviewHandle } from "#lib/types/ui.js";
  import { tableLabelOf } from "#lib/utils/mirror-tables.js";
  import { clipboardFieldFeedback } from "#lib/utils/ui/clipboard.svelte.js";

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
</script>

<tr class="hover:bg-white-5 last:[&>td]:border-b-0">
  <td class="table-td-compact wrap-break-word">
    <Checkbox
      ariaLabel={m["mirror.select_row_aria"]({ name: tableLabelOf(item) })}
      checked={selected}
      onchange={(v: boolean) => onchange(v)}
    />
  </td>
  <td class="table-td-compact wrap-break-word">
    {item.symbol ?? ""}
  </td>
  <td class="table-td-compact min-w-50 wrap-break-word">
    <strong
      use:jsonPreview={{
        preview: mirrorPreview,
        trigger: "contextmenu",
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
  <td class="table-td-compact px-2">
    {#if adminUi.isAdmin}
      <button
        class={btnIconPlain}
        type="button"
        title={authActionTitle}
        aria-label={authActionTitle}
        onclick={() => adminUi.openEdit(item)}
      >
        {#if item.protected === true}
          <Check class="size-4 text-success" aria-hidden="true" strokeWidth={2.5} />
        {:else}
          <TriangleAlert class="size-4 text-[#ffd54f]" aria-hidden="true" />
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
          <Check class="size-4 text-success" aria-hidden="true" strokeWidth={2.5} />
        {:else}
          <TriangleAlert class="size-4 text-[#ffd54f]" aria-hidden="true" />
        {/if}
      </span>
    {/if}
  </td>
  <td class="table-td-compact min-w-32.5 wrap-break-word">
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
          class="flex-none {btnGhostXs}"
          onclick={() => cb.copy("mirror", new URL(item.url, window.location.origin).toString())}
          aria-label={m["mirror.copy_mirror_aria"]()}
        >
          <Copy class="size-4 shrink-0" aria-hidden="true" />
          {m["common.copy"]()}
        </button>
      {/if}
    </div>
  </td>
  <td class="table-td-compact min-w-32.5 wrap-break-word">
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
            class="flex-none {btnGhostXs}"
            onclick={() => cb.copy("original", item.url_from!)}
            aria-label={m["mirror.copy_original_aria"]()}
          >
            <Copy class="size-4 shrink-0" aria-hidden="true" />
            {m["common.copy"]()}
          </button>
        {/if}
      </div>
    {:else}
      <span class="text-white-50">{m["common.none"]()}</span>
    {/if}
  </td>
  {#if showActions}
    <td class="table-td-compact px-2">
      <div class="flex items-center gap-1">
        {#if adminUi.isAdmin}
          <ToggleButton
            size="xs"
            expanded={isExpanded}
            label={isExpanded ? m["mirror.collapse_edit"]() : m["mirror.manage"]()}
            onToggle={() => adminUi.toggleEdit(item)}
          />
        {:else if canDelete && item.protected !== true && ondelete}
          <button
            class={btnDanger}
            type="button"
            title={deleteLabel}
            aria-label={deleteLabel}
            disabled={deleting}
            onclick={() => ondelete(item)}
          >
            <Trash2 class="size-4 shrink-0" aria-hidden="true" />
            {deleting ? m["mirror.deleting"]() : m["common.delete"]()}
          </button>
        {/if}
      </div>
    </td>
  {/if}
</tr>

{#if adminUi.isAdmin && isExpanded}
  {#if adminUi.overviewState === "idle" || adminUi.overviewState === "loading"}
    <tr class="bg-black-30 last:[&>td]:border-b-0">
      <td colspan={columnCount} class="table-td-compact text-[0.9rem] text-white-60">
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
    />
  {/if}
{/if}
