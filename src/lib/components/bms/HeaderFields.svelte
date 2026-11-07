<script lang="ts">
  import HeaderField from "./HeaderField.svelte";
  import LevelOrderEditor from "./LevelOrderEditor.svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import InlineEmpty from "#lib/components/ui/InlineEmpty.svelte";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import { m } from "#lib/paraglide/messages.js";

  /** 头部字段区：查看态文本/胶囊，编辑态输入/编辑器，布局与标签共用。 */
  interface Props {
    editing: boolean;
    name: string;
    symbol: string;
    tag: string;
    mode: string;
    levels: string[];
    extraJson: string;
    disabled?: boolean;
    onchange?: (() => void) | undefined;
    /** 页面通知通道（等级删除的撤销通知直通模型 notice）。 */
    onnotice?: ((notice: EditorNotice) => void) | undefined;
  }

  let {
    editing,
    name = $bindable(""),
    symbol = $bindable(""),
    tag = $bindable(""),
    mode = $bindable(""),
    levels = $bindable([]),
    extraJson,
    disabled = false,
    onchange,
    onnotice = undefined,
  }: Props = $props();
</script>

<div class="flex flex-col gap-4">
  <div class="grid gap-4 sm:grid-cols-2">
    <HeaderField
      label={m["editor.field_name"]()}
      bind:value={name}
      {editing}
      required={true}
      {disabled}
      {onchange}
    />
    <HeaderField
      label={m["editor.field_symbol"]()}
      bind:value={symbol}
      {editing}
      required={true}
      {disabled}
      {onchange}
    />
    <HeaderField label={m["editor.field_tag"]()} bind:value={tag} {editing} {disabled} {onchange} />
    <HeaderField
      label={m["editor.field_mode"]()}
      bind:value={mode}
      {editing}
      {disabled}
      {onchange}
    />
  </div>

  <DetailsPanel
    summary={m["editor.field_level_order"]()}
    hint={editing ? m["editor.level_order_hint"]() : ""}
    variant="plain"
    sub={true}
  >
    {#if editing}
      <LevelOrderEditor bind:levels {disabled} {onchange} {onnotice} />
    {:else if levels.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each levels as level (level)}
          <span
            class="rounded-md border border-white-10 bg-white-5 px-2 py-0.5 text-[0.8rem] text-white-75"
          >
            {level}
          </span>
        {/each}
      </div>
    {:else}
      <InlineEmpty text={m["common.none"]()} />
    {/if}
  </DetailsPanel>

  <DetailsPanel summary={m["editor.extra_json_title"]()} variant="plain" sub={true}>
    {#if extraJson.trim() !== "" && extraJson.trim() !== "{}"}
      <pre
        class="max-h-64 overflow-auto font-mono text-[0.8rem] whitespace-pre-wrap text-white-70">{extraJson}</pre>
    {:else}
      <InlineEmpty text={m["common.none"]()} />
    {/if}
  </DetailsPanel>
</div>
