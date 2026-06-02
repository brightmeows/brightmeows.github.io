<script lang="ts">
  import type { Snippet } from "svelte";

  import BreadcrumbNav from "$lib/components/BreadcrumbNav.svelte";
  import type { TocItem } from "$lib/components/FloatingToc.svelte";
  import FloatingToc from "$lib/components/FloatingToc.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import QuickActions from "$lib/components/QuickActions.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";

  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  interface Props {
    breadcrumbs?: BreadcrumbItem[];
    tocItems?: TocItem[];
    mainClass?: string;
    children: Snippet;
  }

  let {
    breadcrumbs,
    tocItems = [],
    mainClass,
    children,
  }: Props = $props();
</script>

<StarryBackground />
<ProfileCard />
{#if breadcrumbs}
  <BreadcrumbNav items={breadcrumbs} />
{/if}
<main class={mainClass ?? "m-0 mx-auto box-border w-full max-w-350 p-8"}>
  {@render children()}
</main>
{#if tocItems.length > 0}
  <FloatingToc items={tocItems} />
{/if}
<QuickActions />
