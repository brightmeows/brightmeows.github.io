<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";
  import BreadcrumbNav from "$lib/components/BreadcrumbNav.svelte";
  import type { TocItem } from "$lib/components/FloatingToc.svelte";
  import FloatingToc from "$lib/components/FloatingToc.svelte";
  import type { NavChild } from "$lib/components/NavPane.svelte";
  import NavPane from "$lib/components/NavPane.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import QuickActions from "$lib/components/QuickActions.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";
  import { GlassContainer } from "$lib/components/ui";
  import { deriveBreadcrumbs } from "$lib/utils/breadcrumbs";

  interface Props {
    /** 覆写面包屑最后一段的标签（用于动态内容如难度表名、文章标题） */
    currentLabel?: string;
    tocItems?: TocItem[];
    mainClass?: string;
    /** 玻璃面板列表（每个元素为一个独立玻璃面板） */
    panes?: Snippet[];
    /** 自动生成的子页面导航 */
    navChildren?: NavChild[];
    /** 手动追加的快捷导航 */
    navShortcuts?: NavChild[];
  }

  let {
    currentLabel,
    tocItems = [],
    mainClass,
    panes = [],
    navChildren,
    navShortcuts,
  }: Props = $props();

  const breadcrumbs = $derived(deriveBreadcrumbs(page.url.pathname, currentLabel));
  const hasNav = $derived(
    (navChildren?.length ?? 0) > 0 || (navShortcuts?.length ?? 0) > 0,
  );
</script>

<StarryBackground />
<ProfileCard />
<BreadcrumbNav items={breadcrumbs} />
<main class={mainClass ?? "m-0 mx-auto box-border w-full max-w-350 p-8"}>
  {#if panes.length > 0}
    {#each panes as pane, i (i)}
      {@const isFirst = i === 0}
      {@const isLast = i === panes.length - 1}
      <GlassContainer animate={true} class="w-full {!isLast ? 'mb-8' : ''}">
        {@render pane()}
      </GlassContainer>
      {#if isFirst && hasNav}
        <GlassContainer animate={true} class="mb-8 w-full">
          <NavPane children={navChildren} shortcuts={navShortcuts} />
        </GlassContainer>
      {/if}
    {/each}
  {/if}
</main>
{#if tocItems.length > 0}
  <FloatingToc items={tocItems} />
{/if}
<QuickActions />
