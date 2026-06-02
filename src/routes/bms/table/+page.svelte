<script lang="ts">
  import type { PageData } from "./$types";

  import { resolve } from "$app/paths";
  import PageShell from "$lib/components/PageShell.svelte";
  import { GlassCard, GlassContainer } from "$lib/components/ui";

  let { data }: { data: PageData } = $props();
</script>

<PageShell>
  <GlassContainer animate={true} class="mt-8 w-full">
    <h1 class="page-title text-center">BMS 难度表</h1>
    <p class="mt-2 text-center text-[1.1rem] text-white/70">
      选择难度表以浏览谱面列表
    </p>

    <div class="mt-4 flex flex-wrap items-stretch justify-center gap-4">
      {#each data.tables as table (table.id)}
        <GlassCard
          href={resolve(`/bms/table/${table.id}`, {})}
          class="flex w-80 flex-col"
        >
          <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">
            {table.name}
          </div>
          <div class="text-[0.95rem] text-white/80">
            ID: {table.id}
          </div>
        </GlassCard>
      {/each}
    </div>
  </GlassContainer>

  <GlassContainer animate={true} class="mt-8 w-full">
    <h2 class="section-title text-center">更多难度表</h2>
    <div class="mt-4 flex flex-wrap items-stretch justify-center gap-4">
      <GlassCard href={resolve("/bms/table/mirror", {})} class="flex w-80 flex-col">
        <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">难度表镜像</div>
        <div class="text-[0.95rem] text-white/80">
          BMS 难度表镜像列表（支持多语言搜索）
        </div>
      </GlassCard>
    </div>
  </GlassContainer>
</PageShell>
