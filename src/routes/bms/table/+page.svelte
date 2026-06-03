<script lang="ts">
  import type { PageData } from "./$types";

  import { resolve } from "$app/paths";
  import PageShell from "$lib/components/PageShell.svelte";
  import { GlassNavCard } from "$lib/components/ui";

  let { data }: { data: PageData } = $props();
</script>

<PageShell panes={[titlePane, navPane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">BMS 难度表</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white/70">选择难度表以浏览谱面列表</p>
{/snippet}

{#snippet navPane()}
  <h2 class="section-title text-center">更多难度表</h2>
  <div class="mt-4 flex flex-wrap items-stretch justify-center gap-4">
    <GlassNavCard
      href={resolve("/bms/table/mirror", {})}
      title="难度表镜像"
      description="BMS 难度表镜像列表（支持多语言搜索）"
    />
  </div>
{/snippet}

{#snippet contentPane()}
  <div class="flex flex-wrap items-stretch justify-center gap-4">
    {#each data.tables as table (table.id)}
      <GlassNavCard
        href={resolve(`/bms/table/${table.id}`, {})}
        title={table.name}
        description="ID: {table.id}"
      />
    {/each}
  </div>
{/snippet}
