<script lang="ts">
  import LevelOrderEditor from "$lib/components/bms/LevelOrderEditor.svelte";
  import { inputEditorLg } from "$lib/constants/ui-classes";
  import { m } from "$lib/paraglide/messages.js";

  /**
   * 头部字段表单：name/symbol/tag/mode 与 level_order 列表可编辑；
   * course 等未列字段原样保留，以只读 JSON 兜底展示（阶段二再做结构化段位编辑）。
   */
  interface Props {
    name: string;
    symbol: string;
    tag: string;
    mode: string;
    levels: string[];
    /** 未编辑字段的只读 JSON（含 course、level_ref 等自定义字段）。 */
    extraJson: string;
    disabled?: boolean;
    onchange?: (() => void) | undefined;
  }

  let {
    name = $bindable(""),
    symbol = $bindable(""),
    tag = $bindable(""),
    mode = $bindable(""),
    levels = $bindable([]),
    extraJson,
    disabled = false,
    onchange,
  }: Props = $props();
</script>

<section>
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <h3 class="tag-accent-sm">{m["editor.header_section"]()}</h3>
    <span class="text-[0.85rem] text-white/50">{m["editor.header_hint"]()}</span>
  </div>
  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">
        {m["editor.field_name"]()}
        <span class="text-amber-300">*</span>
      </span>
      <input class={inputEditorLg} type="text" bind:value={name} oninput={onchange} {disabled} />
    </label>
    <label class="block">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">
        {m["editor.field_symbol"]()}
        <span class="text-amber-300">*</span>
      </span>
      <input class={inputEditorLg} type="text" bind:value={symbol} oninput={onchange} {disabled} />
    </label>
    <label class="block">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">{m["editor.field_tag"]()}</span>
      <input class={inputEditorLg} type="text" bind:value={tag} oninput={onchange} {disabled} />
    </label>
    <label class="block">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">{m["editor.field_mode"]()}</span>
      <input class={inputEditorLg} type="text" bind:value={mode} oninput={onchange} {disabled} />
    </label>
  </div>

  <div class="mt-6">
    <LevelOrderEditor bind:levels {disabled} {onchange} />
  </div>

  <details class="mt-4 rounded-lg glass-edge bg-glass-deep p-3">
    <summary class="cursor-pointer text-[0.9rem] text-white/60">
      {m["editor.extra_json_title"]()}
    </summary>
    <pre
      class="mt-2 max-h-64 overflow-auto font-mono text-[0.8rem] whitespace-pre-wrap text-white/70">{extraJson}</pre>
  </details>
</section>
