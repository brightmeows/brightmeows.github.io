<script lang="ts">
  import { onMount, tick } from "svelte";

  import BmsContent from "$content/bms/index.md";
  import BreadcrumbNav from "$lib/components/BreadcrumbNav.svelte";
  import FloatingToc, {
    buildTocFromHeadings,
    type TocItem,
  } from "$lib/components/FloatingToc.svelte";
  import MarkdownContent from "$lib/components/MarkdownContent.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import QuickActions from "$lib/components/QuickActions.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";
  import { GlassCard, GlassContainer } from "$lib/components/ui";

  const breadcrumbs = [{ label: "主页", href: "/" }, { label: "BMS" }];

  let tocItems: TocItem[] = [];

  onMount(async () => {
    await tick();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 6 });
  });
</script>

<StarryBackground />
<ProfileCard />
<BreadcrumbNav items={breadcrumbs} sessionKey="breadcrumb-bms-home" initiallyOpen={false} />
<main class="m-0 mx-auto box-border w-full max-w-350 p-8">
  <!-- 菜单部分 -->
  <GlassContainer animate={true} class="mt-8 w-full">
    <h1 class="page-title text-center">BMS</h1>
    <div class="mt-4 flex flex-wrap items-stretch justify-center gap-4">
      <GlassCard href="/bms/table-mirror" class="flex w-80 flex-col">
        <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">难度表镜像</div>
        <div class="text-[0.95rem] text-white/80">BMS 难度表镜像列表（支持多语言搜索）</div>
      </GlassCard>
      <GlassCard href="/bms/table/self-sp" class="flex w-80 flex-col">
        <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">谱面合集（SP）</div>
        <div class="text-[0.95rem] text-white/80">个人 SP 难度表</div>
      </GlassCard>
      <GlassCard href="/bms/table/self-dp" class="flex w-80 flex-col">
        <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">谱面合集（DP）</div>
        <div class="text-[0.95rem] text-white/80">个人 DP 难度表</div>
      </GlassCard>
    </div>
  </GlassContainer>

  <!-- Markdown内容部分 -->
  <GlassContainer animate={true} class="mt-8 w-full">
    <MarkdownContent>
      <BmsContent />
    </MarkdownContent>
  </GlassContainer>
</main>
<FloatingToc items={tocItems} />
<QuickActions />
