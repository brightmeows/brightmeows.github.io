<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";
  import BreadcrumbNav from "$lib/components/BreadcrumbNav.svelte";
  import type { TocItem } from "$lib/components/FloatingToc.svelte";
  import FloatingToc from "$lib/components/FloatingToc.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import QuickActions from "$lib/components/QuickActions.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";
  import { deriveBreadcrumbs } from "$lib/utils/breadcrumbs";

  interface Props {
    /** 覆写面包屑最后一段的标签（用于动态内容如难度表名、文章标题） */
    currentLabel?: string;
    tocItems?: TocItem[];
    mainClass?: string;
    children: Snippet;
  }

  let {
    currentLabel,
    tocItems = [],
    mainClass,
    children,
  }: Props = $props();

  const breadcrumbs = $derived(deriveBreadcrumbs(page.url.pathname, currentLabel));
</script>

<StarryBackground />
<ProfileCard />
<BreadcrumbNav items={breadcrumbs} />
<main class={mainClass ?? "m-0 mx-auto box-border w-full max-w-350 p-8"}>
  {@render children()}
</main>
{#if tocItems.length > 0}
  <FloatingToc items={tocItems} />
{/if}
<QuickActions />
