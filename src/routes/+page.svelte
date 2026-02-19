<script lang="ts">
  import { onMount } from "svelte";

  import { resolve } from "$app/paths";
  import FloatingToc, {
    buildTocFromHeadings,
    type TocItem,
  } from "$lib/components/FloatingToc.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import QuickActions from "$lib/components/QuickActions.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";
  import { GlassButton, GlassContainer } from "$lib/components/ui";
  import { blogPosts } from "$lib/data/blog-posts.generated";

  let tocItems: TocItem[] = [];

  onMount(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<StarryBackground />
<ProfileCard />
<main class="m-0 mx-auto box-border w-full max-w-350 p-8">
  <!-- 菜单部分 -->
  <GlassContainer id="blog" animate={true} class="mt-8 w-full">
    <h1 class="page-title mb-8 text-center">欢迎来到白喵斯的小屋！</h1>
    <div class="mb-8 flex flex-wrap items-center justify-center gap-4">
      <GlassButton href="/bms">BMS 主页</GlassButton>
      <GlassButton href="/bms/table-mirror">BMS 难度表镜像</GlassButton>
      <GlassButton href="/bms/table/self-sp">个人难度表（SP）</GlassButton>
      <GlassButton href="/bms/table/self-dp">个人难度表（DP）</GlassButton>
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

    {#if blogPosts.length === 0}
      <div class="text-center text-white/70">暂无文章</div>
    {:else}
      <div class="flex flex-col gap-4">
        {#each blogPosts as post (post.slug)}
          <a
            class="block rounded-[14px] border border-white/10 bg-black/20 p-6 text-white no-underline transition-[transform,background] duration-300 ease-out hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.06)]"
            href={resolve(post.url, {})}
          >
            <div class="mb-1 flex flex-wrap items-baseline justify-between gap-3">
              <div class="text-[1.2rem] font-bold text-[#64b5f6]">
                {post.title}
              </div>
              {#if post.date}
                <div class="text-[0.85rem] text-white/60">{post.date}</div>
              {/if}
            </div>
            <div class="text-[0.95rem] text-white/80">{post.firstSentence}</div>
          </a>
        {/each}
      </div>
    {/if}
  </GlassContainer>
</main>
<FloatingToc items={tocItems} />
<QuickActions />
