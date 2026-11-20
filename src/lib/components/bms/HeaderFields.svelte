<script lang="ts">
  import HeaderField from "./HeaderField.svelte";
  import LevelOrderEditor from "./LevelOrderEditor.svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import InlineEmpty from "#lib/components/ui/InlineEmpty.svelte";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 头部字段区：两态共用同一套字段单元（HeaderField 查看 readonly 与编辑输入
   * 为同一个 input）。等级顺序查看态胶囊流、编辑态 LevelOrderEditor 行列表，
   * 形态差异是刻意选择：信息等价，编辑态的增删排序按钮没有查看态对应物。
   * extra 自定义字段两态都只读展示，编辑器不提供 header 自定义字段的编辑。
   */
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
    /** 删除类撤销通知的出口（dock notice 区渲染撤销按钮）；缺省不通知。 */
    onNotice?: ((notice: EditorNotice) => void) | undefined;
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
    onNotice = undefined,
  }: Props = $props();
</script>

<div class="flex flex-col gap-4">
  <div class="grid gap-4 sm:grid-cols-2">
    <HeaderField
      label={m["editor.fields.name"]()}
      bind:value={name}
      {editing}
      required={true}
      {disabled}
      {onchange}
    />
    <HeaderField
      label={m["editor.fields.symbol"]()}
      bind:value={symbol}
      {editing}
      required={true}
      {disabled}
      {onchange}
    />
    <HeaderField
      label={m["editor.fields.tag"]()}
      bind:value={tag}
      {editing}
      {disabled}
      {onchange}
    />
    <HeaderField
      label={m["editor.fields.mode"]()}
      bind:value={mode}
      {editing}
      {disabled}
      {onchange}
    />
  </div>

  <DetailsPanel
    summary={m["editor.fields.level_order"]()}
    hint={editing ? m["editor.level.order_hint"]() : ""}
    variant="plain"
    sub={true}
  >
    {#if editing}
      <LevelOrderEditor bind:levels {disabled} {onchange} {onNotice} />
    {:else if levels.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each levels as level (level)}
          <span
            class="rounded-glass-sm border border-white-10 bg-white-5 px-2 py-0.5 text-[0.8rem] text-white-75"
          >
            {level}
          </span>
        {/each}
      </div>
    {:else}
      <InlineEmpty text={m["common.none"]()} />
    {/if}
  </DetailsPanel>

  <DetailsPanel summary={m["editor.fields.extra_title"]()} variant="plain" sub={true}>
    {#if extraJson.trim() !== "" && extraJson.trim() !== "{}"}
      <pre
        class="max-h-64 overflow-auto font-mono text-[0.8rem] whitespace-pre-wrap text-white-70">{extraJson}</pre>
    {:else}
      <InlineEmpty text={m["common.none"]()} />
    {/if}
  </DetailsPanel>
</div>
