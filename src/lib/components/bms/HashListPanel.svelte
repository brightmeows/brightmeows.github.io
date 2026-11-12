<script lang="ts">
  import { parseHashList, type HashListParseResult } from "@brightmeows/bms/hash-list";

  import { btnGhost, inputFile, inputEditorMono } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 哈希清单面板：粘贴或上传“md5 sha256”清单。只负责解析，应用策略
   * （双向补哈希到条目与段位行）交给父级。
   */
  interface Props {
    disabled?: boolean;
    onapply: (parsed: HashListParseResult) => void;
  }

  let { disabled = false, onapply }: Props = $props();

  let listText = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  function applyText(text: string): boolean {
    const parsed = parseHashList(text);
    if (parsed.rows.length === 0) {
      error = m["editor.hashlist_invalid"]({ count: parsed.invalidLines });
      return false;
    }
    error = null;
    onapply(parsed);
    return true;
  }

  function applyList(): void {
    if (applyText(listText)) listText = "";
  }

  async function applyFile(file: File): Promise<void> {
    busy = true;
    try {
      applyText(await file.text());
    } finally {
      busy = false;
    }
  }
</script>

<details class="rounded-glass-sm border border-white-15 bg-black-20 p-3">
  <summary class="cursor-pointer text-[0.9rem] text-white-70">
    {m["editor.hashlist_section"]()}
  </summary>

  <div class="mt-3">
    <p class="mb-2 text-[0.85rem] text-white-60">{m["editor.hashlist_hint"]()}</p>
    <textarea
      class="{inputEditorMono} min-h-32"
      bind:value={listText}
      placeholder={m["editor.hashlist_placeholder"]()}
      {disabled}></textarea>
    <div class="mt-2 flex flex-wrap items-center gap-3">
      <button class={btnGhost} type="button" {disabled} onclick={applyList}>
        {m["editor.import_apply"]()}
      </button>
      <input
        class={inputFile}
        type="file"
        accept=".txt,.csv,.list,.md,text/plain"
        {disabled}
        onchange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file !== undefined) void applyFile(file);
        }}
      />
      {#if busy}
        <span class="text-[0.85rem] text-white-60">{m["editor.import_busy"]()}</span>
      {/if}
    </div>
    {#if error !== null}
      <p class="mt-2 text-[0.85rem] text-error">{error}</p>
    {/if}
  </div>
</details>
