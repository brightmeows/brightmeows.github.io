<script lang="ts">
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { jsonPreview } from "$lib/components/ui/JsonPreview.svelte";
  import type { MirrorTableItem } from "$lib/types/bms";
  import type { JsonPreviewHandle } from "$lib/types/ui";
  import { clipboardFieldFeedback } from "$lib/utils/clipboard.svelte";

  interface Props {
    item: MirrorTableItem;
    selected: boolean;
    onchange: (checked: boolean) => void;
    mirrorPreview?: JsonPreviewHandle;
  }

  let { item, selected, onchange, mirrorPreview }: Props = $props();

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
  </td>
  <td class="table-td-glass min-w-32.5 wrap-break-word">
    <div class="flex items-center gap-1">
      <a
        class="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-[0.2rem] rounded-md border-none bg-[linear-gradient(135deg,#2196f3,#1565c0)] px-2 py-[0.35rem] text-[0.85rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#42a5f5,#1976d2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
        href={item.url}
        title={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        镜像
      </a>
      {#if cb.copiedField === "mirror"}
        <span
          class="flex-none rounded-md border border-green-500/30 bg-green-500/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-green-300"
        >
          已复制!
        </span>
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
        <a
          class="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-[0.2rem] rounded-md border-none bg-[linear-gradient(135deg,#ff9800,#f57c00)] px-2 py-[0.35rem] text-[0.85rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ffb74d,#ff9800)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
          href={item.url_from}
          title={item.url_from}
          target="_blank"
          rel="noopener noreferrer"
        >
          原链接
        </a>
        {#if cb.copiedField === "original"}
          <span
            class="flex-none rounded-md border border-green-500/30 bg-green-500/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-green-300"
          >
            已复制!
          </span>
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
