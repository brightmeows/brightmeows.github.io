<script lang="ts">
  import type { Snippet } from "svelte";

  import HeaderFields from "./HeaderFields.svelte";
  import LevelRefTable from "./LevelRefTable.svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import { m } from "#lib/paraglide/messages.js";

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
    /** 头部 JSON 地址；有值时在概览内挂等级参考折叠区。 */
    headerUrl?: string | undefined;
    levelRefHasData?: boolean;
    levelRefLoadState?: "idle" | "loading" | "done" | "not-found" | "error";
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
    headerUrl = undefined,
    levelRefHasData = $bindable(false),
    levelRefLoadState = $bindable("idle"),
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
  {#if headerUrl !== undefined && headerUrl !== "" && levelRefLoadState !== "not-found"}
    <DetailsPanel id="level-ref" summary={m["levelref.heading"]()} variant="plain" sub={true}>
      <LevelRefTable
        {headerUrl}
        bind:hasData={levelRefHasData}
        bind:loadState={levelRefLoadState}
      />
    </DetailsPanel>
  {/if}
  {#if editing && management && !disabled}
    <div class="mt-6">
      {@render management()}
    </div>
  {/if}
</div>
