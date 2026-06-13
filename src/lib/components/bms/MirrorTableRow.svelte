<script lang="ts">
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { jsonPreview } from "$lib/components/ui/JsonPreview.svelte";
  import type { MirrorTableItem } from "$lib/types/bms";

  interface Props {
    item: MirrorTableItem;
    selected: boolean;
    onchange: (checked: boolean) => void;
    tablePreview:
      | {
          show: (
            options: import("$lib/components/ui/JsonPreview.svelte").JsonPreviewShowOptions,
            clientX: number,
            clientY: number
          ) => void | Promise<void>;
          scheduleHide: () => void;
          hideNow: () => void;
        }
      | undefined;
  }

  let { item, selected, onchange, tablePreview }: Props = $props();
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
        preview: tablePreview,
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
    <a
      class="flex min-w-15 cursor-pointer items-center justify-center gap-[0.2rem] rounded-md border-none bg-[linear-gradient(135deg,#2196f3,#1565c0)] px-2 py-[0.35rem] text-[0.85rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#42a5f5,#1976d2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
      href={item.url}
      title={item.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      镜像
    </a>
  </td>
  <td class="table-td-glass min-w-32.5 wrap-break-word">
    {#if item.url_from}
      <a
        class="flex min-w-15 cursor-pointer items-center justify-center gap-[0.2rem] rounded-md border-none bg-[linear-gradient(135deg,#ff9800,#f57c00)] px-2 py-[0.35rem] text-[0.85rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ffb74d,#ff9800)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
        href={item.url_from}
        title={item.url_from}
        target="_blank"
        rel="noopener noreferrer"
      >
        原链接
      </a>
    {:else}
      <span class="text-white/50">无</span>
    {/if}
  </td>
</tr>
