<script lang="ts">
  import type { Snippet } from "svelte";

  import FloatingToc from "./FloatingToc.svelte";
  import QuickActions from "./QuickActions.svelte";
  import TopBar from "./TopBar.svelte";

  import GlassContainer from "#lib/components/ui/GlassContainer.svelte";
  import StarryBackground from "#lib/components/ui/StarryBackground.svelte";
  import type { TocItem } from "#lib/types/ui.js";

  interface Props {
    tocItems?: TocItem[];
    mainClass?: string;
    /** 玻璃面板列表（每个元素为一个独立玻璃面板） */
    panes?: Snippet[];
  }

  let { tocItems = [], mainClass, panes = [] }: Props = $props();
</script>

<StarryBackground />
<TopBar />
<main class={mainClass ?? "m-0 mx-auto box-border w-full max-w-350 px-8 pt-24 pb-8"}>
  {#each panes as pane, i (i)}
    {@const isLast = i === panes.length - 1}
    <GlassContainer animate={true} class="w-full {!isLast ? 'mb-8' : ''}">
      {@render pane()}
    </GlassContainer>
  {/each}
</main>
{#if tocItems.length > 0}
  <FloatingToc items={tocItems} />
{/if}
<QuickActions />
