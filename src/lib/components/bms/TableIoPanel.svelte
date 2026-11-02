<script lang="ts">
  import type { Snippet } from "svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import { btnGhostMd } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /** 导入导出面板：查看态提供链接与导出，编辑态再加导入；默认折叠。 */
  interface Props {
    editing: boolean;
    headerUrl?: string | null;
    dataUrl?: string | null;
    onExport: (kind: "header" | "data" | "package") => void;
    importSection?: Snippet | undefined;
    exportDisabled?: boolean;
  }

  let {
    editing,
    headerUrl = null,
    dataUrl = null,
    onExport,
    importSection,
    exportDisabled = false,
  }: Props = $props();
</script>

<DetailsPanel
  id="import-export"
  class="scroll-mt-20"
  summary={editing ? m["editor.io_section"]() : m["editor.export_section"]()}
  defaultOpen={false}
>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3 text-[0.9rem]">
      {#if headerUrl}
        <a class="link-accent" href={headerUrl} target="_blank" rel="noopener noreferrer">
          {m["table.view_header"]()}
        </a>
      {/if}
      {#if dataUrl}
        <a class="link-accent" href={dataUrl} target="_blank" rel="noopener noreferrer">
          {m["table.view_data"]()}
        </a>
      {/if}
      {#if !headerUrl && !dataUrl}
        <span class="text-white-50">{m["common.none"]()}</span>
      {/if}
    </div>

    {#if editing && importSection}
      {@render importSection()}
    {/if}

    <div>
      <div class="mb-2 flex flex-wrap items-center gap-3">
        <span class="tag-accent-sm">{m["editor.export_section"]()}</span>
        <span class="text-[0.85rem] text-white-50">{m["editor.export_hint"]()}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          class={btnGhostMd}
          type="button"
          disabled={exportDisabled}
          onclick={() => onExport("header")}
        >
          {m["editor.export_header"]()}
        </button>
        <button
          class={btnGhostMd}
          type="button"
          disabled={exportDisabled}
          onclick={() => onExport("data")}
        >
          {m["editor.export_data"]()}
        </button>
        <button
          class={btnGhostMd}
          type="button"
          disabled={exportDisabled}
          onclick={() => onExport("package")}
        >
          {m["editor.export_package"]()}
        </button>
      </div>
      {#if exportDisabled}
        <p class="mt-2 text-[0.85rem] text-white-50">{m["editor.export_unavailable"]()}</p>
      {/if}
    </div>
  </div>
</DetailsPanel>
