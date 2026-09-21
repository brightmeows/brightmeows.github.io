<script lang="ts">
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import GradientButton from "$lib/components/ui/GradientButton.svelte";
  import { jsonPreview } from "$lib/components/ui/JsonPreview.svelte";
  import { mirrorTablePath } from "$lib/mirror/urls";
  import type { MirrorTableItem } from "$lib/types/bms";
  import type { JsonPreviewHandle } from "$lib/types/ui";
  import { clipboardFieldFeedback } from "$lib/utils/clipboard.svelte";

  interface Props {
    item: MirrorTableItem;
    selected: boolean;
    onchange: (checked: boolean) => void;
    mirrorPreview?: JsonPreviewHandle | undefined;
    /** 是否显示删除按钮（已登录且非受保护）。 */
    deletable?: boolean;
    /** 删除进行中：按钮禁用。 */
    deleting?: boolean;
    ondelete?: ((item: MirrorTableItem) => void) | undefined;
  }

  let {
    item,
    selected,
    onchange,
    mirrorPreview,
    deletable = false,
    deleting = false,
    ondelete,
  }: Props = $props();

  let cb = clipboardFieldFeedback();
</script>

<tr class="hover:bg-white/5 last:[&>td]:border-b-0">
  <td class="table-td-glass wrap-break-word">
    <Checkbox checked={selected} onchange={(v: boolean) => onchange(v)} />
  </td>
  <td class="table-td-glass wrap-break-word">
    {item.symbol ?? ""}
  </td>
  <td class="table-td-glass min-w-50 wrap-break-word">
    <div class="flex flex-wrap items-center gap-2">
      <strong
        class="cursor-default"
        use:jsonPreview={{
          preview: mirrorPreview,
          options: {
            value: item,
            label: `${item.name ?? "难度表"} JSON`,
            maxHeightRem: 14,
          },
        }}
      >
        {item.name}
      </strong>
      {#if item.protected}
        <span
          class="rounded border border-[#ffd54f]/40 bg-[#ffd54f]/15 px-1.5 py-[0.1rem] text-[0.75rem] text-[#ffd54f]"
          title="站长已授权保护，不能删除">已授权</span
        >
      {/if}
      {#if deletable && ondelete}
        <button
          class="cursor-pointer rounded-md border border-red-300/30 bg-red-400/10 px-2 py-[0.2rem] text-[0.8rem] text-red-200 transition-colors duration-200 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={deleting}
          onclick={() => ondelete(item)}
        >
          {deleting ? "删除中…" : "删除"}
        </button>
      {/if}
    </div>
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
        镜像
      </GradientButton>
      {#if cb.copiedField === "mirror"}
        <span class="badge-copied">已复制!</span>
      {:else}
        <button
          class="flex-none cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white"
          onclick={() => cb.copy("mirror", new URL(item.url, window.location.origin).toString())}
          aria-label="复制镜像链接"
        >
          复制
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
          原链接
        </GradientButton>
        {#if cb.copiedField === "original"}
          <span class="badge-copied">已复制!</span>
        {:else}
          <button
            class="flex-none cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white"
            onclick={() => cb.copy("original", item.url_from!)}
            aria-label="复制原链接"
          >
            复制
          </button>
        {/if}
      </div>
    {:else}
      <span class="text-white/50">无</span>
    {/if}
  </td>
</tr>
