<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";
  import type { DisabledEntry } from "@brightmeows/mirror/user-layer";
  import { onMount, tick } from "svelte";

  import GroupedTablesSection from "$lib/components/bms/GroupedTablesSection.svelte";
  import MirrorAdminPanel from "$lib/components/bms/MirrorAdminPanel.svelte";
  import MirrorUserActions from "$lib/components/bms/MirrorUserActions.svelte";
  import SelectedTablesPanel from "$lib/components/bms/SelectedTablesPanel.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import JsonPreview from "$lib/components/ui/JsonPreview.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import {
    collapseAdminEdit,
    initialMirrorAdminState,
    loadOverviewIfNeeded,
    openAdminEdit,
    runAdminAction,
    toggleAdminEdit,
    type MirrorAdminDeps,
    type MirrorAdminState,
  } from "$lib/controllers/mirror-admin";
  import { auth } from "$lib/data/auth-store.svelte";
  import { toFailure } from "$lib/data/http";
  import {
    adminAuthorize,
    adminDisable,
    adminMeta,
    adminReplace,
    adminRestore,
    fetchAdminOverview,
    type TrashEntry,
  } from "$lib/data/mirror-admin-api";
  import { loadMirrorTables } from "$lib/data/mirror-table-loader";
  import { submitDelete } from "$lib/data/mirror-user-api";
  import { searchConverters } from "$lib/data/search-converters.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { MirrorAdminUi, MirrorMetaFields } from "$lib/types/bms-view";
  import type { AsyncState } from "$lib/types/common";
  import type { JsonPreviewHandle, TocItem } from "$lib/types/ui";
  import { clipboardFeedback } from "$lib/utils/clipboard.svelte";
  import {
    buildSearchNeedles,
    collectTagValues,
    filterTables,
    findMetaOverride,
    groupByTags,
    nextTagOrder,
    removeTableByUrl,
    setTableProtected,
    sourceUrlOf,
    tableLabelOf,
  } from "$lib/utils/mirror-tables";
  import { buildGroupTocItems } from "$lib/utils/toc";

  /**
   * 镜像列表页：清单加载与筛选分组、用户操作区与管理区。清单状态走
   * AsyncState；管理区状态转移（总览缓存、写操作串行、编辑卡展开）在
   * controllers/mirror-admin（可单测），本页只持状态、弹确认与拼 i18n 文案。
   */
  const tablesJsonPath = "/bms/table/mirror/tables.json";
  const pageTitle = m["mirror.page_title"]();
  const baseRoute = "bms/table/mirror";

  // 清单三态与数据（数据另行持有：治理动作会做本地即时变更再重拉）
  let listState = $state<AsyncState<MirrorTableItem[]>>({ phase: "loading" });
  let tables = $state<MirrorTableItem[]>([]);
  let selectedMap = $state<Record<string, boolean>>({});
  let searchQuery = $state("");
  let showProtectedOnly = $state(false);
  let tocItems = $state<TocItem[]>([]);

  let cb = clipboardFeedback();

  // 登录态在共享 store（与顶栏同源）：非空时列表行显示删除按钮
  /** MirrorUserActions 实例：删除后刷新其配额与回收站列表。 */
  let userActions = $state<{ refresh: () => Promise<void> } | undefined>(undefined);
  let deletingDir = $state<string | null>(null);

  let mirrorPreview = $state<JsonPreviewHandle | undefined>(undefined);

  // ---- 管理交互（仅 ADMIN_LOGIN 角色可见，服务端权限不变） ----
  let admin = $state<MirrorAdminState>(initialMirrorAdminState());
  let adminPanelOpen = $state(false);
  let currentHash = $state("");

  const isAdmin = $derived(auth.status === "ready" && auth.user?.role === "admin");

  // 标签编辑建议：现有值去重排序，新标签序号取现有最大值加一
  const tag1Options = $derived(collectTagValues(tables, "tag1"));
  const tag2Options = $derived(collectTagValues(tables, "tag2"));
  const nextOrder = $derived(nextTagOrder(tables));

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

  // 顶栏管理入口以 #mirror-admin 锚点落页：登录态就绪后展开管理区并滚动到位
  $effect(() => {
    if (!isAdmin || currentHash !== "#mirror-admin") return;
    if (!adminPanelOpen) {
      adminPanelOpen = true;
      void loadOverview(false);
    }
    void tick().then(() => {
      document.getElementById("mirror-admin")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  function deps(): MirrorAdminDeps {
    return { fetchOverview: fetchAdminOverview };
  }

  async function loadTables(cacheBust = false): Promise<void> {
    try {
      tables = await loadMirrorTables(tablesJsonPath, baseRoute, { cacheBust });
      listState = { phase: "ready", data: tables };
    } catch (e) {
      listState = toFailure(e);
    }
  }

  /** 用户操作（添加/删除/恢复）后刷新清单与登录态。 */
  function handleUserChanged(): void {
    void loadTables(true);
  }

  async function loadOverview(force: boolean): Promise<void> {
    admin = await loadOverviewIfNeeded(admin, deps(), force);
  }

  /** 串行执行管理写操作：成功后提示，失败展示错误；忙时忽略新点击。 */
  async function runAdmin(action: () => Promise<void>, okText: string): Promise<boolean> {
    const result = await runAdminAction(admin, action, okText);
    admin = result.state;
    return result.ok;
  }

  async function handleDelete(item: MirrorTableItem): Promise<void> {
    const dirName = item.dir_name;
    if (dirName === undefined || dirName === "") return;
    const label = item.name === "" ? dirName : item.name;
    if (!window.confirm(m["mirror.delete_confirm"]({ name: label }))) {
      return;
    }
    deletingDir = dirName;
    admin = { ...admin, notice: null };
    try {
      await submitDelete(dirName);
      admin = { ...admin, notice: { kind: "ok", text: m["mirror.deleted"]({ name: label }) } };
      await loadTables(true);
      await userActions?.refresh();
    } catch (e) {
      admin = {
        ...admin,
        notice: {
          kind: "error",
          text: e instanceof Error ? e.message : m["mirror.delete_failed"](),
        },
      };
    } finally {
      deletingDir = null;
    }
  }

  // ---- 管理区与行内治理 ----

  function toggleEdit(item: MirrorTableItem): void {
    if (!isAdmin) return;
    void toggleAdminEdit(admin, deps(), item.url).then((next) => (admin = next));
  }

  /** 打开编辑面板（幂等）：授权图标点击用，已展开时保持展开。 */
  function openEdit(item: MirrorTableItem): void {
    if (!isAdmin) return;
    void openAdminEdit(admin, deps(), item.url).then((next) => (admin = next));
  }

  function toggleAdminPanel(): void {
    adminPanelOpen = !adminPanelOpen;
    if (adminPanelOpen) void loadOverview(false);
  }

  function handleAuthorize(item: MirrorTableItem): void {
    if (!isAdmin) return;
    const action: "add" | "remove" = item.protected === true ? "remove" : "add";
    const label = tableLabelOf(item);
    const confirmText =
      action === "add"
        ? m["mirror.auth_confirm_add"]({ name: label })
        : m["mirror.auth_confirm_remove"]({ name: label });
    if (!window.confirm(confirmText)) return;
    void runAdmin(
      async () => {
        await adminAuthorize(sourceUrlOf(item), item.dir_name, action);
        tables = setTableProtected(tables, item.url, action === "add");
        await loadTables(true);
      },
      action === "add" ? m["admin.joined"]({ name: label }) : m["admin.removed"]({ name: label })
    );
  }

  function handleDisable(item: MirrorTableItem, note: string): void {
    if (!isAdmin) return;
    const label = tableLabelOf(item);
    if (!window.confirm(m["mirror.disable_confirm"]({ name: label }))) return;
    void runAdmin(
      async () => {
        await adminDisable(sourceUrlOf(item), item.dir_name, "add", note === "" ? undefined : note);
        tables = removeTableByUrl(tables, item.url);
        admin = collapseAdminEdit(admin, item.url);
        await loadTables(true);
        await loadOverview(true);
      },
      m["admin.disabled"]({ name: label })
    );
  }

  function handleMetaSave(item: MirrorTableItem, fields: MirrorMetaFields): void {
    if (!isAdmin) return;
    const label = tableLabelOf(item);
    void runAdmin(
      async () => {
        await adminMeta(sourceUrlOf(item), "set", fields);
        admin = { ...admin, expandedUrl: null };
        await loadTables(true);
        await loadOverview(true);
      },
      m["admin.meta_saved"]({ name: label })
    );
  }

  function handleMetaClear(item: MirrorTableItem): void {
    if (!isAdmin) return;
    const label = tableLabelOf(item);
    void runAdmin(
      async () => {
        await adminMeta(sourceUrlOf(item), "clear", {});
        admin = { ...admin, expandedUrl: null };
        await loadTables(true);
        await loadOverview(true);
      },
      m["admin.meta_cleared"]({ name: label })
    );
  }

  function handleReplaceAdd(from: string, to: string): Promise<boolean> {
    return runAdmin(async () => {
      await adminReplace(from, to, "add");
      await loadTables(true);
      await loadOverview(true);
    }, m["admin.rule_added"]());
  }

  function handleReplaceRemove(from: string): Promise<boolean> {
    return runAdmin(async () => {
      await adminReplace(from, undefined, "remove");
      await loadTables(true);
      await loadOverview(true);
    }, m["admin.rule_removed"]());
  }

  function handleEnable(entry: DisabledEntry): Promise<boolean> {
    return runAdmin(
      async () => {
        await adminDisable(entry.url, entry.dir_name, "remove");
        await loadTables(true);
        await loadOverview(true);
      },
      m["admin.enabled"]({ name: entry.dir_name ?? entry.url })
    );
  }

  function handleRestore(entry: TrashEntry): Promise<boolean> {
    return runAdmin(
      async () => {
        await adminRestore(entry.dir_name);
        await loadTables(true);
        await loadOverview(true);
      },
      m["admin.restored"]({ dir: entry.dir_name })
    );
  }

  const adminUi = $derived<MirrorAdminUi>({
    isAdmin,
    overviewState: admin.overviewState,
    expandedUrl: admin.expandedUrl,
    busy: admin.busy,
    overrideOf: (item: MirrorTableItem) => findMetaOverride(admin.overview?.meta ?? null, item),
    toggleEdit: (item: MirrorTableItem) => toggleEdit(item),
    openEdit: (item: MirrorTableItem) => openEdit(item),
    authorize: (item: MirrorTableItem) => handleAuthorize(item),
    disable: (item: MirrorTableItem, note: string) => handleDisable(item, note),
    saveMeta: (item: MirrorTableItem, fields: MirrorMetaFields) => handleMetaSave(item, fields),
    clearMeta: (item: MirrorTableItem) => handleMetaClear(item),
    tag1Options,
    tag2Options,
    nextTagOrder: nextOrder,
  });

  onMount(() => {
    void loadTables();
    const syncHash = (): void => {
      currentHash = window.location.hash;
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
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

    {#if admin.notice}
      <div
        class="text-center text-[0.9rem] {admin.notice.kind === 'ok'
          ? 'text-[#4caf50]'
          : 'text-red-300'}"
      >
        {admin.notice.text}
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
      {#if isAdmin}
        <button
          class="cursor-pointer rounded-md border px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 {adminPanelOpen
            ? 'border-[#64b5f6]/60 bg-[#64b5f6]/20 text-[#64b5f6]'
            : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'}"
          type="button"
          aria-expanded={adminPanelOpen}
          onclick={toggleAdminPanel}
        >
          {m["mirror.manage"]()}
        </button>
      {/if}
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

    {#if isAdmin}
      <div id="mirror-admin" class="scroll-mt-5">
        {#if adminPanelOpen}
          <MirrorAdminPanel
            overviewState={admin.overviewState}
            error={admin.overviewError}
            overview={admin.overview}
            busy={admin.busy}
            onretry={() => void loadOverview(true)}
            onreplaceadd={handleReplaceAdd}
            onreplaceremove={handleReplaceRemove}
            onenable={handleEnable}
            onrestore={handleRestore}
          />
        {/if}
      </div>
    {/if}
  </div>

  {#if listState.phase === "loading"}
    <div class="mt-6">
      <LoadingProgress variant="indeterminate" message={m["mirror.loading"]()} title={pageTitle} />
    </div>
  {:else if listState.phase === "error"}
    <div class="mt-6 text-red-300">
      {m["common.load_failed_with_error"]({ error: listState.message })}
    </div>
  {:else if listState.phase === "unavailable"}
    <div class="mt-6 text-red-300">
      {m["common.load_failed_with_error"]({ error: m["common.unknown_error"]() })}
    </div>
  {:else if groupedByTags.length === 0}
    <div class="mt-6 text-white/70">
      {showProtectedOnly ? m["mirror.no_match_protected"]() : m["mirror.no_match"]()}
    </div>
  {:else}
    <GroupedTablesSection
      bind:selectedMap
      groups={groupedByTags}
      {adminUi}
      {mirrorPreview}
      showDelete={auth.user !== null}
      {deletingDir}
      ondelete={(item: MirrorTableItem) => void handleDelete(item)}
    />
  {/if}
{/snippet}

<SelectedTablesPanel {tables} bind:selectedMap {mirrorPreview} {displayOrderUrls} />
<JsonPreview bind:this={mirrorPreview} />
