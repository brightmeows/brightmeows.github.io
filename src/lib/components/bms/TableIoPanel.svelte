<script lang="ts">
  import type { Snippet } from "svelte";

  import { btnGhost } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /** 导入导出内容：查看态提供链接与导出，编辑态再加导入；卡片显隐由页面管理。 */
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
      <span class="text-text-secondary">{m["common.none"]()}</span>
    {/if}
  </div>

  {#if editing && importSection}
    {@render importSection()}
  {/if}

  <div>
    {#if editing}
      <div class="mb-2 flex flex-wrap items-center gap-3">
        <h3 class="text-[0.95rem] font-semibold text-text-secondary">
          {m["editor.export_section"]()}
        </h3>
      </div>
    {/if}
    <div class="flex flex-wrap gap-2">
      <button
        class={btnGhost}
        type="button"
        disabled={exportDisabled}
        onclick={() => onExport("header")}
      >
        {m["editor.export_header"]()}
      </button>
      <button
        class={btnGhost}
        type="button"
        disabled={exportDisabled}
        onclick={() => onExport("data")}
      >
        {m["editor.export_data"]()}
      </button>
      <button
        class={btnGhost}
        type="button"
        disabled={exportDisabled}
        onclick={() => onExport("package")}
      >
        {m["editor.export_package"]()}
      </button>
    </div>
    {#if exportDisabled}
      <p class="mt-2 text-[0.85rem] text-text-secondary">{m["editor.export_unavailable"]()}</p>
    {/if}
  </div>
</div>
