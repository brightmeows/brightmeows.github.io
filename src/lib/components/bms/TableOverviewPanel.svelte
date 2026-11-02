<script lang="ts">
  import type { Snippet } from "svelte";

  import TableHeaderForm from "./TableHeaderForm.svelte";

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
  defaultOpen={false}
>
  {#if editing}
    <TableHeaderForm
      bind:name
      bind:symbol
      bind:tag
      bind:mode={headerMode}
      bind:levels
      {extraJson}
      {disabled}
      showHeading={false}
      onchange={onChange}
    />
    {#if management}
      <div class="mt-6">
        {@render management()}
      </div>
    {/if}
  {:else}
    <div class="flex flex-col gap-3">
      <div class="grid gap-3 sm:grid-cols-2">
        {#each [{ label: m["editor.field_name"](), value: name }, { label: m["editor.field_symbol"](), value: symbol }, { label: m["editor.field_tag"](), value: tag }, { label: m["editor.field_mode"](), value: headerMode }] as field (field.label)}
          <div>
            <div class="text-[0.8rem] text-white-50">{field.label}</div>
            <div class="text-[0.95rem] text-white-85">
              {field.value === "" ? m["common.none"]() : field.value}
            </div>
          </div>
        {/each}
      </div>

      <div>
        <div class="mb-1 text-[0.8rem] text-white-50">{m["editor.field_level_order"]()}</div>
        {#if levels.length > 0}
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
          <div class="text-[0.9rem] text-white-50">{m["common.none"]()}</div>
        {/if}
      </div>

      <details class="rounded-lg border border-white-10 bg-black-20 p-3">
        <summary class="cursor-pointer text-[0.85rem] text-white-60">
          {m["editor.extra_json_title"]()}
        </summary>
        {#if Object.keys(extraHeader).length > 0}
          <pre
            class="mt-2 max-h-64 overflow-auto font-mono text-[0.8rem] whitespace-pre-wrap text-white-70">{extraJson}</pre>
        {:else}
          <p class="mt-2 text-[0.9rem] text-white-50">{m["common.none"]()}</p>
        {/if}
      </details>
    </div>
  {/if}
</DetailsPanel>
