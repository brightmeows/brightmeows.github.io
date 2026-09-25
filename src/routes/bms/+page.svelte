<script lang="ts">
  import { onMount, tick } from "svelte";

  import BmsContentEn from "./index.en.md";
  import BmsContentZh from "./index.zh.md";

  import MarkdownContent from "$lib/components/content/MarkdownContent.svelte";
  import { buildTocFromHeadings } from "$lib/components/layout/FloatingToc.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import type { TocItem } from "$lib/types/ui";

  // 双语双份源文件，按构建 locale 选用（问题25 的双份承载）
  const BmsContent = __SITE_LOCALE__ === "zh-cn" ? BmsContentZh : BmsContentEn;

  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell {tocItems} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS</h1>
{/snippet}

{#snippet contentPane()}
  <MarkdownContent>
    <BmsContent />
  </MarkdownContent>
{/snippet}
