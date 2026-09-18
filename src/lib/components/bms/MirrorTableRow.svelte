<script lang="ts">
  import { GradientButton } from "$lib/components/ui";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { jsonPreview } from "$lib/components/ui/JsonPreview.svelte";
  import { viewerPath } from "$lib/mirror/urls";
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
      <GradientButton
        variant="blue"
        href={item.dir_name ? viewerPath(item.dir_name) : item.url}
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
