<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";

  /**
   * 头部字段表单：核心子集可编辑（name/symbol/tag/level_order/mode）；
   * course 等未列字段原样透传，以只读原始 JSON 兜底展示（不静默丢数据）。
   */
  interface Props {
    name: string;
    symbol: string;
    tag: string;
    mode: string;
    levelOrderText: string;
    /** course 段位数量（只读提示；0 不显示）。 */
    courseCount?: number;
    /** 未编辑字段的只读 JSON（含 course、level_ref 等自定义字段）。 */
    extraJson: string;
    disabled?: boolean;
  }

  let {
    name = $bindable(""),
    symbol = $bindable(""),
    tag = $bindable(""),
    mode = $bindable(""),
    levelOrderText = $bindable(""),
    courseCount = 0,
    extraJson,
    disabled = false,
  }: Props = $props();

  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-[0.95rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
</script>

<section>
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <h3 class="tag-accent-sm">{m["shared.header_section"]()}</h3>
    {#if courseCount > 0}
      <span class="rounded-[10px] bg-white/10 px-2 py-[0.1rem] text-[0.8rem] text-white/60">
        {m["shared.course_preserved"]({ count: courseCount })}
      </span>
    {/if}
  </div>
  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">
        {m["shared.field_name"]()}
        <span class="text-amber-300">*</span>
      </span>
      <input class={inputClass} type="text" bind:value={name} {disabled} />
    </label>
    <label class="block">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">
        {m["shared.field_symbol"]()}
        <span class="text-amber-300">*</span>
      </span>
      <input class={inputClass} type="text" bind:value={symbol} {disabled} />
    </label>
    <label class="block">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">{m["shared.field_tag"]()}</span>
      <input class={inputClass} type="text" bind:value={tag} {disabled} />
    </label>
    <label class="block">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">{m["shared.field_mode"]()}</span>
      <input class={inputClass} type="text" bind:value={mode} {disabled} />
    </label>
    <label class="block sm:col-span-2">
      <span class="mb-1.5 block text-[0.9rem] text-white/70">
        {m["shared.field_level_order"]()}
      </span>
      <textarea
        class="{inputClass} min-h-32 font-mono text-[0.85rem]"
        bind:value={levelOrderText}
        {disabled}
        placeholder={m["shared.field_level_order_hint"]()}></textarea>
      <span class="mt-1 block text-[0.8rem] text-white/45">
        {m["shared.field_level_order_help"]()}
      </span>
    </label>
  </div>
  <details class="mt-3 rounded-lg border border-white/15 bg-black/20 p-3">
    <summary class="cursor-pointer text-[0.9rem] text-white/60">
      {m["shared.extra_json_title"]()}
    </summary>
    <pre
      class="mt-2 max-h-64 overflow-auto font-mono text-[0.8rem] whitespace-pre-wrap text-white/70">{extraJson}</pre>
  </details>
</section>
