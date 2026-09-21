<script lang="ts">
  import { onMount, tick } from "svelte";

  import GroupedTablesSection from "$lib/components/bms/GroupedTablesSection.svelte";
  import MirrorUserActions from "$lib/components/bms/MirrorUserActions.svelte";
  import SelectedTablesPanel from "$lib/components/bms/SelectedTablesPanel.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import JsonPreview from "$lib/components/ui/JsonPreview.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { loadMirrorTables } from "$lib/data/mirror-table-loader";
  import { submitDelete, type CurrentUser } from "$lib/data/mirror-user-api";
  import type { MirrorTableItem } from "$lib/types/bms";
  import type { JsonPreviewHandle, TocItem } from "$lib/types/ui";
  import { clipboardFeedback } from "$lib/utils/clipboard.svelte";
  import { buildSearchNeedles, filterTables, groupByTags } from "$lib/utils/mirror-tables";
  import { getSearchConverters } from "$lib/utils/opencc-loader";
  import { buildGroupTocItems } from "$lib/utils/toc";

  const tablesJsonPath = "/bms/table/mirror/tables.json";
  const pageTitle = "BMS 难度表镜像";
  const baseRoute = "bms/table/mirror";

  let loading = $state(true);
  let error = $state<string | null>(null);

  let cb = clipboardFeedback();

  let tables = $state<MirrorTableItem[]>([]);
  let selectedMap = $state<Record<string, boolean>>({});
  let searchQuery = $state("");
  let showProtectedOnly = $state(false);
  let tocItems = $state<TocItem[]>([]);

  // 登录态由 MirrorUserActions 上报：非空时列表行显示删除按钮
  let currentUser = $state<CurrentUser | null>(null);
  /** MirrorUserActions 实例：删除后刷新其登录态与回收站列表。 */
  let userActions = $state<{ refresh: () => Promise<void> } | undefined>(undefined);
  let deletingDir = $state<string | null>(null);
  let actionNotice = $state<{ kind: "ok" | "error"; text: string } | null>(null);

  let mirrorPreview = $state<JsonPreviewHandle | undefined>(undefined);

  let searchConverters = $state<((input: string) => string)[]>([]);

  // opencc-js 约 1.1MB，延迟到用户首次聚焦搜索框时加载，避免进入页面即下载
  let convertersLoaded = false;
  function ensureConverters(): void {
    if (convertersLoaded) return;
    convertersLoaded = true;
    void getSearchConverters().then((c) => (searchConverters = c));
  }

  function copyTables(): void {
    const url = new URL(tablesJsonPath, window.location.origin).toString();
    void cb.copy(url);
  }

  let searchNeedles = $derived(buildSearchNeedles(searchQuery, searchConverters));
  let filteredTables = $derived(filterTables(tables, searchNeedles));
  // 筛选：启用「已授权」时仅保留受删除保护的表
  let protectedFilteredTables = $derived(
    showProtectedOnly ? filteredTables.filter((t) => t.protected === true) : filteredTables
  );
  let groupedByTags = $derived(groupByTags(protectedFilteredTables));
  // 展示顺序 URL 列表（用于浮动面板 JSON 排序，与 GroupedTablesSection 内顺序一致）
  let displayOrderUrls = $derived(
    groupedByTags.flatMap((group) => group.subgroups.flatMap((sg) => sg.items.map((i) => i.url)))
  );

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

  /** 用户操作（添加/删除/恢复）后刷新清单与登录态。 */
  function handleUserChanged(): void {
    void loadTables();
  }

  async function handleDelete(item: MirrorTableItem): Promise<void> {
    const dirName = item.dir_name;
    if (dirName === undefined || dirName === "") return;
    const label = item.name === "" ? dirName : item.name;
    if (!window.confirm(`确定删除「${label}」吗？删除后 30 天内可在本页自助恢复。`)) {
      return;
    }
    deletingDir = dirName;
    actionNotice = null;
    try {
      await submitDelete(dirName);
      actionNotice = { kind: "ok", text: `已删除「${label}」，清单约 1 分钟后更新。` };
      await loadTables();
      await userActions?.refresh();
    } catch (e) {
      actionNotice = { kind: "error", text: e instanceof Error ? e.message : "删除失败" };
    } finally {
      deletingDir = null;
    }
  }

  onMount(() => {
    void loadTables();
    void tick();
  });
</script>

<PageShell {tocItems} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 id="bms-table-mirror" class="page-title mb-2 scroll-mt-5 text-center">{pageTitle}</h1>

  <div class="mt-1 text-center text-[1.1rem] text-white/70 italic">
    对于BeMusicSeeker用户，可以使用tables.json链接（
    <button class="link-accent" type="button" onclick={copyTables}> 点击复制 </button>
    ），导入难度表清单至BeMusicSeeker。
    <a
      class="link-accent"
      href="https://darksabun.club/table/tablelist.html"
      target="_blank"
      rel="noopener noreferrer"
    >
      使用教程
    </a>
    {#if cb.copied}
      <span class="ml-2 text-[#4caf50]">已复制</span>
    {/if}
  </div>
{/snippet}

{#snippet contentPane()}
  <div class="flex flex-col gap-3">
    <MirrorUserActions
      bind:this={userActions}
      onchanged={handleUserChanged}
      onuserchange={(value: CurrentUser | null) => (currentUser = value)}
    />

    {#if actionNotice}
      <div
        class="text-center text-[0.9rem] {actionNotice.kind === 'ok'
          ? 'text-[#4caf50]'
          : 'text-red-300'}"
      >
        {actionNotice.text}
      </div>
    {/if}

    <div class="flex flex-wrap items-center justify-center gap-3">
      <h2 class="section-title">全部难度表</h2>
      <label
        class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 select-none {showProtectedOnly
          ? 'border-[#ffd54f] bg-[#ffd54f]/20 text-[#ffd54f]'
          : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'}"
      >
        <Checkbox
          size="sm"
          checked={showProtectedOnly}
          onchange={(v: boolean) => (showProtectedOnly = v)}
        />
        已授权（受保护）
      </label>
    </div>

    <div class="relative w-full">
      <input
        class="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30"
        type="text"
        placeholder="按 名称 / 符号 搜索，支持 简体中文 / 繁体中文 / 日文汉字 自动转换"
        bind:value={searchQuery}
        onfocus={ensureConverters}
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
    {#if searchQuery.trim().length > 0 || showProtectedOnly}
      <div class="text-[0.95rem] text-white/60">
        匹配 {protectedFilteredTables.length} / {tables.length}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="mt-6">
      <LoadingProgress
        variant="indeterminate"
        message="正在加载镜像列表..."
        title="BMS 难度表镜像"
      />
    </div>
  {:else if error}
    <div class="mt-6 text-red-300">加载失败：{error}</div>
  {:else if groupedByTags.length === 0}
    <div class="mt-6 text-white/70">
      {showProtectedOnly ? "没有匹配的已授权难度表" : "没有匹配的难度表"}
    </div>
  {:else}
    <GroupedTablesSection
      bind:selectedMap
      groups={groupedByTags}
      {mirrorPreview}
      showDelete={currentUser !== null}
      {deletingDir}
      ondelete={(item: MirrorTableItem) => void handleDelete(item)}
    />
  {/if}
{/snippet}

<SelectedTablesPanel {tables} bind:selectedMap {mirrorPreview} {displayOrderUrls} />
<JsonPreview bind:this={mirrorPreview} />
