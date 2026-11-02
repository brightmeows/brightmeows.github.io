<script lang="ts">
  import type { Snippet } from "svelte";

  import HeaderFields from "./HeaderFields.svelte";

  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import { m } from "#lib/paraglide/messages.js";

  /** 概览面板：查看态只读摘要，编辑态复用头部表单；默认折叠。 */
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
  }: Props = $props();

  const extraJson = $derived(JSON.stringify(extraHeader, null, 2));
</script>

<DetailsPanel
  id="overview"
  class="scroll-mt-20"
  summary={m["editor.header_section"]()}
  hint={m["editor.header_hint"]()}
  variant="plain"
  defaultOpen={false}
>
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
  />
  {#if editing && management && !disabled}
    <div class="mt-6">
      {@render management()}
    </div>
  {/if}
</DetailsPanel>
