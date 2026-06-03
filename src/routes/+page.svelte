<script lang="ts">
  import { onMount } from "svelte";

  import type { PageData } from "./$types";

  import { resolve } from "$app/paths";
  import BlogPostCard from "$lib/components/BlogPostCard.svelte";
  import { buildTocFromHeadings, type TocItem } from "$lib/components/FloatingToc.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import { GlassButton, GlassContainer } from "$lib/components/ui";

  let { data }: { data: PageData } = $props();

  let tocItems = $state<TocItem[]>([]);

  onMount(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<PageShell {tocItems}>
  <!-- 菜单部分 -->
  <GlassContainer id="blog" animate={true} class="mt-8 w-full">
    <h1 class="page-title mb-8 text-center">欢迎来到白喵斯的小屋！</h1>
    <div class="mb-8 flex flex-wrap items-center justify-center gap-4">
      <GlassButton href={resolve("/bms", {})}>BMS 主页</GlassButton>
      <GlassButton href={resolve("/bms/table/mirror", {})}>BMS 难度表镜像</GlassButton>
      <GlassButton href={resolve("/bms/table/self-sp", {})}>个人难度表（SP）</GlassButton>
      <GlassButton href={resolve("/bms/table/self-dp", {})}>个人难度表（DP）</GlassButton>
    </div>
  </GlassContainer>

  <GlassContainer animate={true} class="mt-8 w-full">
    <div class="mb-6 flex flex-wrap items-baseline justify-between gap-3">
      <h2 class="section-title m-0">博客</h2>
      <a
        class="text-sm text-sky-300 no-underline transition hover:text-sky-200"
        href={resolve("/blog", {})}
      >
        查看全部 →
      </a>
    </div>

    {#if !data.recentPosts || data.recentPosts.length === 0}
      <div class="text-center text-white/70">暂无文章</div>
    {:else}
      <div class="flex flex-col gap-4">
        {#each data.recentPosts as post (post.slug)}
          <BlogPostCard {post} />
        {/each}
      </div>
    {/if}
  </GlassContainer>
</PageShell>
