<script lang="ts">
  import * as OpenCC from "opencc-js";
  import { onMount, tick } from "svelte";

  import { resolve } from "$app/paths";
  import type { TocItem } from "$lib/components/FloatingToc.svelte";
  import PageShell from "$lib/components/PageShell.svelte";
  import GroupedTablesSection from "$lib/components/bms/GroupedTablesSection.svelte";
  import SelectedTablesPanel from "$lib/components/bms/SelectedTablesPanel.svelte";
  import { GlassCard } from "$lib/components/ui";
  import { loadMirrorTables } from "$lib/data/mirror-table-loader";
  import type { MirrorTableItem } from "$lib/types/bms";
  import { writeToClipboard } from "$lib/utils/clipboard";
  import {
    buildSearchNeedles,
    filterTables,
    groupByTags,
    buildGroupTocItems,
  } from "$lib/utils/mirror-tables";

  interface LinkItem {
    href: string;
    title: string;
    desc: string;
  }

  interface Props {
    tablesJsonPath: string;
    pageTitle: string;
    baseRoute: string;
  }

  let { tablesJsonPath, pageTitle, baseRoute }: Props = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);

  let copied = $state(false);

  let tables = $state<MirrorTableItem[]>([]);
  let selectedMap = $state<Record<string, boolean>>({});
  let searchQuery = $state("");
  let tocItems = $state<TocItem[]>([]);

  type StringConverter = (input: string) => string;

  const searchConverters: StringConverter[] = (() => {
    try {
      return [
        OpenCC.Converter({ from: "cn", to: "jp" }),
        OpenCC.Converter({ from: "jp", to: "cn" }),
        OpenCC.Converter({ from: "cn", to: "tw" }),
        OpenCC.Converter({ from: "tw", to: "cn" }),
      ];
    } catch {
      return [];
    }
  })();

  const links: LinkItem[] = [
    { href: "/bms", title: "返回 BMS", desc: "返回 BMS 页面" },
    {
      href: "https://codeberg.org/brightmeows/bms-table-mirror",
      title: "镜像仓库",
      desc: "查看镜像项目",
    },
  ];

  async function copyTables(): Promise<void> {
    const tablesJsonUrl = new URL(tablesJsonPath, window.location.origin).toString();
    const ok = await writeToClipboard(tablesJsonUrl);
    if (!ok) return;
    copied = true;
    void setTimeout(() => {
      copied = false;
    }, 1500);
  }

  let searchNeedles = $derived(buildSearchNeedles(searchQuery, searchConverters));
  let filteredTables = $derived(filterTables(tables, searchNeedles));
  let groupedByTags = $derived(groupByTags(filteredTables));

  $effect(() => {
    const tagItems = buildGroupTocItems(groupedByTags);

    tocItems = [
      {
        id: "bms-table-mirror",
        title: pageTitle,
        href: "#bms-table-mirror",
      },
      {
        id: "mirror-list",
        title: "镜像列表",
        href: "#mirror-list",
        children: tagItems,
      },
    ];
  });

  async function loadTables(): Promise<void> {
    try {
      tables = await loadMirrorTables(tablesJsonPath, baseRoute);
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : "未知错误";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadTables();
    void tick();
  });
</script>

<PageShell {tocItems} panes={[titlePane, navPane, contentPane]} />

{#snippet titlePane()}
  <h1 id="bms-table-mirror" class="page-title mb-2 scroll-mt-5 text-center">{pageTitle}</h1>

  <div class="mt-2 text-center text-[1.1rem] text-white/70 italic">
    对于BeMusicSeeker用户，可以使用tables.json链接（
    <button
      class="m-0 cursor-pointer border-0 bg-transparent p-0 font-medium text-[#64b5f6] underline hover:text-[#42a5f5]"
      type="button"
      onclick={copyTables}
    >
      点击复制
    </button>
    ），导入难度表清单至BeMusicSeeker。
    <a
      class="m-0 cursor-pointer border-0 bg-transparent p-0 font-medium text-[#64b5f6] underline hover:text-[#42a5f5]"
      href="https://darksabun.club/table/tablelist.html"
      target="_blank"
      rel="noopener noreferrer"
    >
      使用教程
    </a>
    {#if copied}
      <span class="ml-2 text-[#4caf50]">已复制</span>
    {/if}
  </div>
{/snippet}

{#snippet navPane()}
  <div class="flex flex-wrap items-stretch justify-center gap-4">
    {#each links as link (link.href)}
      <GlassCard
        href={link.href.startsWith("/") ? resolve(link.href, {}) : link.href}
        class="flex w-80 flex-col"
      >
        <div class="mb-2 text-[1.2rem] font-bold text-[#64b5f6]">
          {link.title}
        </div>
        <div class="text-[0.95rem] text-white/80">{link.desc}</div>
      </GlassCard>
    {/each}
  </div>
{/snippet}

{#snippet contentPane()}
  <div class="flex flex-col gap-3">
    <div class="relative w-full">
      <input
        class="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30"
        type="text"
        placeholder="按 名称 / 符号 搜索，支持 简体中文 / 繁体中文 / 日文汉字 自动转换"
        bind:value={searchQuery}
      />
      {#if searchQuery.trim().length > 0}
        <button
          class="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white/20 bg-white/10 p-0 text-[1.25rem] leading-none text-white transition-all duration-200 ease-in-out hover:bg-white/20"
          type="button"
          aria-label="清空搜索"
          onclick={() => (searchQuery = "")}
        >
          ×
        </button>
      {/if}
    </div>
    {#if searchQuery.trim().length > 0}
      <div class="text-[0.95rem] text-white/60">
        匹配 {filteredTables.length} / {tables.length}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="mt-6 text-white/80">正在加载镜像列表...</div>
  {:else if error}
    <div class="mt-6 text-red-300">加载失败：{error}</div>
  {:else if groupedByTags.length === 0}
    <div class="mt-6 text-white/70">没有匹配的难度表</div>
  {:else}
    <GroupedTablesSection bind:selectedMap groups={groupedByTags} />
  {/if}
{/snippet}

<SelectedTablesPanel {tables} {selectedMap} />
