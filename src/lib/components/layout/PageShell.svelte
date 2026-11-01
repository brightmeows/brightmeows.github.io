<script lang="ts">
  import type { Snippet } from "svelte";

  import TopBar from "./TopBar.svelte";

  import GlassContainer from "#lib/components/ui/GlassContainer.svelte";
  import StarryBackground from "#lib/components/ui/StarryBackground.svelte";
  import type { TocItem } from "#lib/types/ui.js";

  interface Props {
    tocItems?: TocItem[];
    /** 内容列宽度：default 为 1400（列表与阅读页），wide 为 1920（功能页）。 */
    width?: "default" | "wide";
    /** 标题区：并入主玻璃顶部，加载与错误时保持常驻。 */
    header?: Snippet;
    /** 内容区。 */
    children?: Snippet;
  }

  let { tocItems = [], width = "default", header, children }: Props = $props();

  const widthClass = $derived(width === "wide" ? "max-w-[120rem]" : "max-w-350");
</script>

<StarryBackground />
<TopBar {tocItems} />
<main class="m-0 mx-auto box-border w-full {widthClass} px-4 pt-24 pb-8 sm:px-6 lg:px-8">
  <GlassContainer animate={true} padding="none" class="w-full overflow-hidden">
    {#if header}
      <header class="border-b border-white-10 px-5 py-5 sm:px-6 lg:px-8">
        {@render header()}
      </header>
    {/if}
    <div class="px-5 py-6 sm:px-6 lg:px-8">
      {#if children}
        {@render children()}
      {/if}
    </div>
  </GlassContainer>
</main>
