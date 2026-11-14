<script lang="ts">
  import ChevronsRight from "@lucide/svelte/icons/chevrons-right";
  import type { Snippet } from "svelte";

  import TopBar from "./TopBar.svelte";

  import DustTrailCanvas from "#lib/components/ui/DustTrailCanvas.svelte";
  import GlassContainer from "#lib/components/ui/GlassContainer.svelte";
  import StarryBackground from "#lib/components/ui/StarryBackground.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem } from "#lib/types/ui.js";

  interface Props {
    tocItems?: TocItem[];
    mainClass?: string;
    /** 玻璃面板列表（每个元素为一个独立玻璃面板） */
    panes?: Snippet[];
    /** 宽屏（≥1400px）左侧目录侧栏；提供后主内容变两栏，窄屏整列自动隐藏 */
    sidebar?: Snippet | undefined;
    /** 侧栏收缩态：整列隐藏，左缘显示贴边把手 */
    sidebarCollapsed?: boolean;
    /** 贴边把手点击（展开侧栏） */
    onExpandSidebar?: () => void;
    /** 无侧栏时把 pane 收窄到正文卡宽度（工具与列表页保持全宽默认） */
    constrainPanes?: boolean;
  }

  let {
    tocItems = [],
    mainClass,
    panes = [],
    sidebar,
    sidebarCollapsed = false,
    onExpandSidebar,
    constrainPanes = false,
  }: Props = $props();
</script>

<a href="#main" class="skip-link">{m["common.skip_to_content"]()}</a>
<StarryBackground />
<DustTrailCanvas />
<TopBar {tocItems} />
<main id="main" class={mainClass ?? "m-0 mx-auto box-border w-full max-w-350 px-8 pt-24 pb-8"}>
  {#if sidebar}
    <div class="flex w-full items-start justify-center gap-10">
      {#if !sidebarCollapsed}
        <!-- 目录侧栏是滚动容器，tabindex 让键盘用户可滚（滚动容器指南口径），规则误报 -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <aside
          class="sticky top-16 hidden max-h-[calc(100vh-6rem)] w-[260px] shrink-0 overflow-y-auto pr-1 pb-4 min-[1400px]:block"
          aria-label={m["toc.title"]()}
          tabindex="0"
        >
          {@render sidebar()}
        </aside>
      {/if}
      <div class="mx-auto w-full max-w-[1000px] min-w-0 flex-1">
        {#each panes as pane, i (i)}
          {@const isLast = i === panes.length - 1}
          <GlassContainer animate={true} class="w-full {!isLast ? 'mb-8' : ''}">
            {@render pane()}
          </GlassContainer>
        {/each}
      </div>
    </div>
    {#if sidebarCollapsed && onExpandSidebar}
      <button
        type="button"
        class="fixed top-1/2 left-3 z-30 hidden size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-glass text-white-60 shadow-(--glass-lighting) transition-colors hover:text-white min-[1400px]:flex"
        title={m["toc.sidebar.expand"]()}
        aria-label={m["toc.sidebar.expand"]()}
        onclick={onExpandSidebar}
      >
        <ChevronsRight class="size-4" aria-hidden="true" />
      </button>
    {/if}
  {:else}
    {#each panes as pane, i (i)}
      {@const isLast = i === panes.length - 1}
      <GlassContainer
        animate={true}
        class="{constrainPanes ? 'mx-auto w-full max-w-[1000px]' : 'w-full'} {!isLast
          ? 'mb-8'
          : ''}"
      >
        {@render pane()}
      </GlassContainer>
    {/each}
  {/if}
</main>
