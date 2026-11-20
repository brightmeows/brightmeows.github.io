<script lang="ts">
  import CloudDownload from "@lucide/svelte/icons/cloud-download";
  import Users from "@lucide/svelte/icons/users";

  import type { PageData } from "./$types";

  import BmsTableList from "#lib/components/bms/BmsTableList.svelte";
  import PageHero from "#lib/components/layout/PageHero.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import GlassCard from "#lib/components/ui/GlassCard.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { resolve } from "$app/paths";

  /**
   * 表总览（索引页）：共享表与镜像表的入口卡在上，自托管表列表（SSG 枚举）
   * 全量内联在下。刻意不拉运行时清单：共享与镜像列表各在独立页，
   * 索引页保持零运行时取数、即开即用。
   */
  const pageTitle = m["table.index.title"]();

  let { data }: { data: PageData } = $props();
</script>

<PageShell hero={heroPane} panes={[contentPane]} />

{#snippet heroPane()}
  <PageHero titleText={pageTitle} intro={m["table.index.subtitle"]()}>
    {#snippet title()}{pageTitle}{/snippet}
  </PageHero>
{/snippet}

{#snippet contentPane()}
  <div class="grid gap-4 sm:grid-cols-2">
    <GlassCard href={resolve("/bms/table/shared")} padding="lg">
      <div class="flex items-center gap-3">
        <Users class="size-5 shrink-0 text-accent" aria-hidden="true" />
        <h2 class="text-[1.05rem] font-semibold text-white-85">{m["nav.shared"]()}</h2>
      </div>
      <p class="mt-2 text-[0.9rem] text-white-60">{m["table.index.shared_desc"]()}</p>
    </GlassCard>
    <GlassCard href={resolve("/bms/table/mirror")} padding="lg">
      <div class="flex items-center gap-3">
        <CloudDownload class="size-5 shrink-0 text-accent" aria-hidden="true" />
        <h2 class="text-[1.05rem] font-semibold text-white-85">{m["nav.mirror"]()}</h2>
      </div>
      <p class="mt-2 text-[0.9rem] text-white-60">{m["table.index.mirror_desc"]()}</p>
    </GlassCard>
  </div>

  <div class="mt-8">
    <BmsTableList tables={data.tables} />
  </div>
{/snippet}
