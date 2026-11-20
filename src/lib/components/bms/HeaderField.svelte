<script lang="ts">
  import { inputEditorLg } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 头部字段的只读/编辑共用单元：标签、必填标记与排版只写一份。
   * 两态同为同一个 input 元素，查看态经 readonly 呈现（可选中复制、不灰化、
   * tab 可达）；刻意不用 disabled（拦复制且视觉灰化）与文本 div（与编辑态
   * 形态断裂），2026-11 两态一致性盘问敲定。
   * 值为受控单向下发：输入经 oninput 写回 $bindable value 再回传父级；
   * 查看态空值显示“无”文案，readonly 不触发 input 事件，不回写模型。
   */
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

  const shown = $derived(editing || value !== "" ? value : m["common.none"]());

  function handleInput(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    value = input.value;
    onchange?.();
  }
</script>

<label class="block">
  <span class="mb-1.5 block text-[0.85rem] text-white-60">
    {label}
    {#if editing && required}<span class="text-amber-300">*</span>{/if}
  </span>
  <input
    class={inputEditorLg}
    type="text"
    value={shown}
    readonly={!editing}
    oninput={handleInput}
    disabled={editing && disabled}
  />
</label>
