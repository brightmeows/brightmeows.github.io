<script lang="ts">
  import { untrack, type Snippet } from "svelte";

  /**
   * 原生 details 折叠面板：默认收起，键盘与语义由浏览器提供。
   * plain 变体去掉内层卡表面，供外层已有玻璃卡的分区使用；
   * collapsible 为 false 时保留同一套标题排版但不折叠。
   */
  interface Props {
    summary: string;
    hint?: string;
    id?: string | undefined;
    class?: string;
    defaultOpen?: boolean;
    variant?: "inset" | "plain";
    collapsible?: boolean;
    /** plain 变体内的子折叠：标题降一级，避免与区块标题同权。 */
    sub?: boolean;
    actions?: Snippet | undefined;
    children: Snippet;
  }

  let {
    summary,
    hint = "",
    id = undefined,
    class: className = "",
    defaultOpen = false,
    variant = "inset",
    collapsible = true,
    sub = false,
    actions,
    children,
  }: Props = $props();

  let open = $state(untrack(() => defaultOpen));

  const plain = $derived(variant === "plain");
  const titleSize = $derived(plain && sub ? "text-[0.95rem]" : "text-[1.05rem]");
  const containerClass = $derived(
    plain ? className : `rounded-xl border border-white-10 bg-black-20 ${className}`
  );
  const headerClass = $derived(
    plain
      ? `flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-0 py-2.5 ${titleSize} text-white-85 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none`
      : "flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 text-[0.95rem] text-white-85 transition-colors hover:bg-white-5 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
  );
  const staticHeaderClass = $derived(
    plain
      ? `flex flex-wrap items-center gap-x-3 gap-y-1 px-0 py-2.5 ${titleSize} text-white-85`
      : "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 text-[0.95rem] text-white-85"
  );
  const bodyClass = $derived(
    plain ? "border-t border-white-10 pt-3" : "border-t border-white-10 px-4 py-3"
  );
</script>

{#snippet header()}
  <h2 class="m-0 font-semibold">{summary}</h2>
  {#if hint}
    <span class="text-[0.85rem] text-white-50">{hint}</span>
  {/if}
  <span class="ml-auto flex flex-wrap items-center justify-end gap-2">
    {#if actions}
      {@render actions()}
    {/if}
    {#if collapsible}
      <svg
        class="size-4 flex-none text-white-50 transition-transform duration-200 {open
          ? 'rotate-180'
          : ''}"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    {/if}
  </span>
{/snippet}

{#if collapsible}
  <details {id} class={containerClass} bind:open>
    <summary class={headerClass}>
      {@render header()}
    </summary>
    <div class={bodyClass}>
      {@render children()}
    </div>
  </details>
{:else}
  <section {id} class={containerClass}>
    <div class={staticHeaderClass}>
      {@render header()}
    </div>
    <div class={bodyClass}>
      {@render children()}
    </div>
  </section>
{/if}
