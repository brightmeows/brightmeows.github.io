<script lang="ts">
  import type { Snippet } from "svelte";

  import HeaderFields from "./HeaderFields.svelte";

  import type { EditorNotice } from "#lib/controllers/editor.js";

  /** 概览内容：查看态只读摘要，编辑态复用头部表单；卡片显隐由页面管理。 */
  interface Props {
    editing: boolean;
    name: string;
    symbol: string;
    tag: string;
    headerMode: string;
    levels: string[];
    extraHeader: Record<string, unknown>;
    disabled?: boolean;
    management?: Snippet | undefined;
    onChange?: (() => void) | undefined;
    /** 删除类撤销通知的出口（dock notice 区渲染撤销按钮）；缺省不通知。 */
    onNotice?: ((notice: EditorNotice) => void) | undefined;
  }

  let {
    editing,
    name = $bindable(""),
    symbol = $bindable(""),
    tag = $bindable(""),
    headerMode = $bindable(""),
    levels = $bindable([]),
    extraHeader = $bindable({}),
    disabled = false,
    management,
    onChange,
    onNotice = undefined,
  }: Props = $props();

  const extraJson = $derived(JSON.stringify(extraHeader, null, 2));
</script>

<div class="flex flex-col gap-4">
  <HeaderFields
    {editing}
    bind:name
    bind:symbol
    bind:tag
    bind:mode={headerMode}
    bind:levels
    {extraJson}
    {disabled}
    onchange={onChange}
    {onNotice}
  />
  {#if editing && management && !disabled}
    <div class="mt-6">
      {@render management()}
    </div>
  {/if}
</div>
