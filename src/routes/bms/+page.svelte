<script lang="ts">
  import { onMount, tick } from "svelte";

  import BmsContentEn from "./index.en.md";
  import BmsContentJa from "./index.ja.md";
  import BmsContentZh from "./index.zh.md";

  import MarkdownContent from "#lib/components/content/MarkdownContent.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import PageHeader from "#lib/components/ui/PageHeader.svelte";
  import type { TocItem } from "#lib/types/ui.js";
  import { buildTocFromHeadings } from "#lib/utils/ui/toc.js";

  // 三语源文件，按构建 locale 选用
  const BmsContent =
    __SITE_LOCALE__ === "zh-cn"
      ? BmsContentZh
      : __SITE_LOCALE__ === "ja"
        ? BmsContentJa
        : BmsContentEn;

  let tocItems = $state<TocItem[]>([]);

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell {tocItems}>
  {#snippet header()}
    <div class="mx-auto max-w-[44rem]">
      <PageHeader title="BMS" />
    </div>
  {/snippet}

  <MarkdownContent>
    <BmsContent />
  </MarkdownContent>
</PageShell>
