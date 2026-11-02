<script lang="ts">
  import { inputEditorLg } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /** 头部字段的只读/编辑共用单元：标签、必填标记与排版只写一份。 */
  interface Props {
    label: string;
    value: string;
    editing: boolean;
    required?: boolean;
    disabled?: boolean;
    onchange?: (() => void) | undefined;
  }

  let {
    label,
    value = $bindable(""),
    editing,
    required = false,
    disabled = false,
    onchange,
  }: Props = $props();
</script>

{#if editing}
  <label class="block">
    <span class="mb-1.5 block text-[0.85rem] text-white-60">
      {label}
      {#if required}<span class="text-amber-300">*</span>{/if}
    </span>
    <input class={inputEditorLg} type="text" bind:value oninput={onchange} {disabled} />
  </label>
{:else}
  <div>
    <div class="mb-1 text-[0.85rem] text-white-50">{label}</div>
    <div class="text-[0.95rem] text-white-85">
      {value === "" ? m["common.none"]() : value}
    </div>
  </div>
{/if}
