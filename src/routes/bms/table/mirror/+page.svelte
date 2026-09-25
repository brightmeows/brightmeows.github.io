<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";
  import { onMount, tick } from "svelte";

  import GroupedTablesSection from "$lib/components/bms/GroupedTablesSection.svelte";
  import MirrorUserActions from "$lib/components/bms/MirrorUserActions.svelte";
  import SelectedTablesPanel from "$lib/components/bms/SelectedTablesPanel.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import JsonPreview from "$lib/components/ui/JsonPreview.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { auth } from "$lib/data/auth-store.svelte";
  import { loadMirrorTables } from "$lib/data/mirror-table-loader";
  import { submitDelete } from "$lib/data/mirror-user-api";
  import { searchConverters } from "$lib/data/search-converters.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { JsonPreviewHandle, TocItem } from "$lib/types/ui";
  import { clipboardFeedback } from "$lib/utils/clipboard.svelte";
  import { buildSearchNeedles, filterTables, groupByTags } from "$lib/utils/mirror-tables";
  import { buildGroupTocItems } from "$lib/utils/toc";

  const tablesJsonPath = "/bms/table/mirror/tables.json";
  const pageTitle = m["mirror.page_title"]();
  const baseRoute = "bms/table/mirror";

  let loading = $state(true);
  let error = $state<string | null>(null);

  let cb = clipboardFeedback();

  let tables = $state<MirrorTableItem[]>([]);
  let selectedMap = $state<Record<string, boolean>>({});
  let searchQuery = $state("");
  let showProtectedOnly = $state(false);
  let tocItems = $state<TocItem[]>([]);

  // 登录态在共享 store（与顶栏同源）：非空时列表行显示删除按钮
  /** MirrorUserActions 实例：删除后刷新其配额与回收站列表。 */
  let userActions = $state<{ refresh: () => Promise<void> } | undefined>(undefined);
  let deletingDir = $state<string | null>(null);
  let actionNotice = $state<{ kind: "ok" | "error"; text: string } | null>(null);

  let mirrorPreview = $state<JsonPreviewHandle | undefined>(undefined);

  // opencc-js 约 1.1MB：转换器在搜索框首次聚焦时才懒加载（共享 store，见 search-converters.svelte）

  function copyTables(): void {
    const url = new URL(tablesJsonPath, window.location.origin).toString();
    void cb.copy(url);
  }

  let searchNeedles = $derived(buildSearchNeedles(searchQuery, searchConverters.list));
  let filteredTables = $derived(filterTables(tables, searchNeedles));
  // 筛选：启用“已授权”时仅保留受删除保护的表
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
        title: m["mirror.list_heading"](),
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
      error = e instanceof Error ? e.message : m["common.unknown_error"]();
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
    if (!window.confirm(m["mirror.delete_confirm"]({ name: label }))) {
      return;
    }
    deletingDir = dirName;
    actionNotice = null;
    try {
      await submitDelete(dirName);
      actionNotice = { kind: "ok", text: m["mirror.deleted"]({ name: label }) };
      await loadTables();
      await userActions?.refresh();
    } catch (e) {
      actionNotice = {
        kind: "error",
        text: e instanceof Error ? e.message : m["mirror.delete_failed"](),
      };
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
    {m["mirror.bms_hint_before"]()}
    <button class="link-accent" type="button" onclick={copyTables}>
      {m["common.click_copy"]()}
    </button>
    {m["mirror.bms_hint_after"]()}
    <a
      class="link-accent"
      href="https://darksabun.club/table/tablelist.html"
      target="_blank"
      rel="noopener noreferrer"
    >
      {m["mirror.tutorial"]()}
    </a>
    {#if cb.copied}
      <span class="ml-2 text-[#4caf50]">{m["common.copied"]()}</span>
    {/if}
  </div>
{/snippet}

{#snippet contentPane()}
  <div class="flex flex-col gap-3">
    <MirrorUserActions bind:this={userActions} onchanged={handleUserChanged} />

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
      <h2 class="section-title">{m["mirror.all_tables"]()}</h2>
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
        {m["mirror.protected_filter"]()}
      </label>
    </div>

    <div class="relative w-full">
      <input
        class="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30"
        type="text"
        placeholder={m["mirror.search_placeholder"]()}
        bind:value={searchQuery}
        onfocus={searchConverters.ensureLoaded}
      />
      {#if searchQuery.trim().length > 0}
        <button
          class="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white/20 bg-white/10 p-0 text-[1.25rem] leading-none text-white transition-all duration-200 ease-in-out hover:bg-white/20"
          type="button"
          aria-label={m["common.clear_search"]()}
          onclick={() => (searchQuery = "")}
        >
          ×
        </button>
      {/if}
    </div>
    {#if searchQuery.trim().length > 0 || showProtectedOnly}
      <div class="text-[0.95rem] text-white/60">
        {m["common.matched"]({
          shown: protectedFilteredTables.length,
          total: tables.length,
        })}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="mt-6">
      <LoadingProgress variant="indeterminate" message={m["mirror.loading"]()} title={pageTitle} />
    </div>
  {:else if error}
    <div class="mt-6 text-red-300">{m["common.load_failed_with_error"]({ error })}</div>
  {:else if groupedByTags.length === 0}
    <div class="mt-6 text-white/70">
      {showProtectedOnly ? m["mirror.no_match_protected"]() : m["mirror.no_match"]()}
    </div>
  {:else}
    <GroupedTablesSection
      bind:selectedMap
      groups={groupedByTags}
      {mirrorPreview}
      showDelete={auth.user !== null}
      {deletingDir}
      ondelete={(item: MirrorTableItem) => void handleDelete(item)}
    />
  {/if}
{/snippet}

<SelectedTablesPanel {tables} bind:selectedMap {mirrorPreview} {displayOrderUrls} />
<JsonPreview bind:this={mirrorPreview} />
