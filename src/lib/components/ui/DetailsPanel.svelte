<script lang="ts">
  import { untrack, type Snippet } from "svelte";

  /**
   * 原生 details 折叠面板：默认收起，键盘与语义由浏览器提供。
   */
  interface Props {
    summary: string;
    hint?: string;
    id?: string | undefined;
    class?: string;
    defaultOpen?: boolean;
    children: Snippet;
  }

  let {
    summary,
    hint = "",
    id = undefined,
    class: className = "",
    defaultOpen = false,
    children,
  }: Props = $props();

  let open = $state(untrack(() => defaultOpen));
</script>

<details {id} class="group rounded-xl border border-white-10 bg-black-20 {className}" bind:open>
  <summary
    class="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 text-[0.95rem] text-white-85 transition-colors hover:bg-white-5 focus-visible:ring-2 focus-visible:ring-[#64b5f6]/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
  >
    <span class="font-semibold">{summary}</span>
    {#if hint}
      <span class="text-[0.85rem] text-white-50">{hint}</span>
    {/if}
    <svg
      class="ml-auto size-4 flex-none text-white-50 transition-transform duration-200 group-open:rotate-180"
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
  </summary>
  <div class="border-t border-white-10 px-4 py-3">
    {@render children()}
  </div>
</details>
