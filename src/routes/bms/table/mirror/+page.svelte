<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";
  import type { DisabledEntry } from "@brightmeows/mirror/user-layer";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import { onMount, tick } from "svelte";

  import GroupedTablesSection from "#lib/components/bms/GroupedTablesSection.svelte";
  import MirrorAdminPanel from "#lib/components/bms/MirrorAdminPanel.svelte";
  import MirrorUserActions from "#lib/components/bms/MirrorUserActions.svelte";
  import SelectedTablesPanel from "#lib/components/bms/SelectedTablesPanel.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import CardSwitcher, { type CardSwitchItem } from "#lib/components/ui/CardSwitcher.svelte";
  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import { createConfirmDialog } from "#lib/components/ui/confirm-dialog.svelte.js";
  import ConfirmDialog from "#lib/components/ui/ConfirmDialog.svelte";
  import JsonPreview from "#lib/components/ui/JsonPreview.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import {
    btnChip,
    btnChipOnAccent,
    btnChipOnWarning,
    btnGhostXs,
    btnInputClear,
    inputPanel,
  } from "#lib/constants/ui-classes.js";
  import {
    collapseAdminEdit,
    initialMirrorAdminState,
    loadOverviewIfNeeded,
    openAdminEdit,
    runAdminAction,
    toggleAdminEdit,
    type MirrorAdminDeps,
    type MirrorAdminState,
  } from "#lib/controllers/mirror-admin.js";
  import { toFailure } from "#lib/data/api/http.js";
  import {
    adminAuthorize,
    adminDisable,
    adminMeta,
    adminReplace,
    adminRestore,
    fetchAdminOverview,
    type TrashEntry,
  } from "#lib/data/api/mirror-admin-api.js";
  import { loadMirrorTables } from "#lib/data/api/mirror-table-loader.js";
  import { submitDelete } from "#lib/data/api/mirror-user-api.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
  import { searchConverters } from "#lib/data/store/search-converters.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MirrorAdminUi, MirrorMetaFields } from "#lib/types/bms-view.js";
  import type { AsyncState } from "#lib/types/common.js";
  import type { JsonPreviewHandle, TocItem } from "#lib/types/ui.js";
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
  } from "#lib/utils/mirror-tables.js";
  import { clipboardFeedback } from "#lib/utils/ui/clipboard.svelte.js";
  import { buildGroupTocItems } from "#lib/utils/ui/toc.js";

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
  let operationsMode = $state(false);
  let tocItems = $state<TocItem[]>([]);

  let cb = clipboardFeedback();

  // 登录态在共享 store（与顶栏同源）：非空时列表行显示删除按钮
  /** MirrorUserActions 实例：删除后刷新其配额与回收站列表。 */
  let userActions = $state<{ refresh: () => Promise<void> } | undefined>(undefined);
  let deletingDir = $state<string | null>(null);

  let mirrorPreview = $state<JsonPreviewHandle | undefined>(undefined);

  type MirrorCardId = "mirror-add" | "mirror-list";
  let visibleCards = $state<Record<MirrorCardId, boolean>>({
    "mirror-add": false,
    "mirror-list": true,
  });

  const cardItems = $derived<CardSwitchItem[]>([
    ...(auth.status === "ready"
      ? [
          {
            id: "mirror-add",
            label: m["mirror.add_table"](),
            checked: visibleCards["mirror-add"],
            title: m["mirror.add_table_hint"](),
          },
        ]
      : []),
    {
      id: "mirror-list",
      label: m["mirror.all_tables"](),
      checked: visibleCards["mirror-list"],
      count: tables.length,
    },
  ]);

  function toggleCard(id: string, checked: boolean): void {
    visibleCards = { ...visibleCards, [id as MirrorCardId]: checked };
  }

  async function jumpToCard(id: string): Promise<void> {
    const cardId = id as MirrorCardId;
    if (!visibleCards[cardId]) {
      visibleCards = { ...visibleCards, [cardId]: true };
      await tick();
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

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
  let groupedByTags = $derived(
    groupByTags(protectedFilteredTables, {
      untagged: m["mirror.untagged"](),
      other: m["mirror.other"](),
    })
  );
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
      ...(visibleCards["mirror-list"]
        ? [
            {
              id: "mirror-list",
              title: m["mirror.all_tables"](),
              href: "#mirror-list",
              children: tagItems,
            },
          ]
        : []),
    ];
  });

  // #mirror-admin 锚点落页（书签与历史链接）：登录态就绪后展开管理区并滚动到位
  $effect(() => {
    if (!isAdmin || currentHash !== "#mirror-admin") return;
    if (!visibleCards["mirror-list"]) {
      visibleCards = { ...visibleCards, "mirror-list": true };
    }
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

  const confirmDialog = createConfirmDialog();

  async function handleDelete(item: MirrorTableItem): Promise<void> {
    const dirName = item.dir_name;
    if (dirName === undefined || dirName === "") return;
    const label = item.name === "" ? dirName : item.name;
    if (!(await confirmDialog.ask(m["mirror.delete_confirm"]({ name: label })))) {
      return;
    }
    deletingDir = dirName;
    admin = { ...admin, notice: null };
    try {
      await submitDelete(dirName);
      admin = { ...admin, notice: { kind: "ok", text: m["mirror.deleted"]({ name: label }) } };
      await loadTables(true);
      await userActions?.refresh();
      if (userActions === undefined) await auth.refresh();
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

  async function handleAuthorize(item: MirrorTableItem): Promise<void> {
    if (!isAdmin) return;
    const action: "add" | "remove" = item.protected === true ? "remove" : "add";
    const label = tableLabelOf(item);
    const confirmText =
      action === "add"
        ? m["mirror.auth_confirm_add"]({ name: label })
        : m["mirror.auth_confirm_remove"]({ name: label });
    if (!(await confirmDialog.ask(confirmText))) return;
    void runAdmin(
      async () => {
        await adminAuthorize(sourceUrlOf(item), item.dir_name, action);
        tables = setTableProtected(tables, item.url, action === "add");
        await loadTables(true);
      },
      action === "add" ? m["admin.joined"]({ name: label }) : m["admin.removed"]({ name: label })
    );
  }

  async function handleDisable(item: MirrorTableItem, note: string): Promise<void> {
    if (!isAdmin) return;
    const label = tableLabelOf(item);
    if (!(await confirmDialog.ask(m["mirror.disable_confirm"]({ name: label })))) return;
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

<PageShell
  {tocItems}
  panes={[
    titlePane,
    ...(auth.status === "ready" && visibleCards["mirror-add"] ? [addTablePane] : []),
    ...(visibleCards["mirror-list"] ? [listPane] : []),
  ]}
/>

{#snippet titlePane()}
  <h1 id="bms-table-mirror" class="page-title mb-2 scroll-mt-5 text-center">{pageTitle}</h1>

  <div class="mt-1 text-center text-[1.1rem] text-white-70 italic">
    {m["mirror.bms_hint_before"]()}
    <button class="link-accent" type="button" onclick={copyTables}>
      {m["common.click_copy"]()}
    </button>
    {m["mirror.bms_hint_after"]()}
    <a
      class={btnGhostXs}
      href="https://darksabun.club/table/tablelist.html"
      target="_blank"
      rel="noopener noreferrer"
    >
      <ExternalLink class="size-4 shrink-0" aria-hidden="true" />
      {m["mirror.tutorial"]()}
    </a>
    {#if cb.copied}
      <span class="ml-2 text-success">{m["common.copied"]()}</span>
    {/if}
  </div>
  <div class="mt-4">
    <CardSwitcher
      items={cardItems}
      ariaLabel={m["table.sections"]()}
      align="center"
      onToggle={toggleCard}
      onJump={(id) => void jumpToCard(id)}
    />
  </div>
{/snippet}

{#snippet addTablePane()}
  <div id="mirror-add" class="scroll-mt-20">
    <MirrorUserActions bind:this={userActions} onchanged={handleUserChanged} />
  </div>
{/snippet}

{#snippet listPane()}
  <div id="mirror-list" class="scroll-mt-20">
    <div class="flex flex-col gap-3">
      {#if admin.notice}
        <div
          class="text-center text-[0.9rem] {admin.notice.kind === 'ok'
            ? 'text-success'
            : 'text-error'}"
        >
          {admin.notice.text}
        </div>
      {/if}

      <div class="flex flex-wrap items-center gap-2">
        <label class={showProtectedOnly ? btnChipOnWarning : btnChip}>
          <Checkbox
            size="sm"
            ariaLabel={m["mirror.protected_filter"]()}
            checked={showProtectedOnly}
            onchange={(v: boolean) => (showProtectedOnly = v)}
          />
          {m["mirror.protected_filter"]()}
        </label>
        {#if auth.user !== null}
          <label class={operationsMode ? btnChipOnAccent : btnChip}>
            <Checkbox
              size="sm"
              ariaLabel={m["mirror.operations_mode"]()}
              checked={operationsMode}
              onchange={(v: boolean) => (operationsMode = v)}
            />
            {m["mirror.operations_mode"]()}
          </label>
        {/if}
        {#if isAdmin}
          <button
            class={adminPanelOpen ? btnChipOnAccent : btnChip}
            type="button"
            aria-expanded={adminPanelOpen}
            onclick={toggleAdminPanel}
          >
            {m["mirror.admin_panel"]()}
          </button>
        {/if}
      </div>
      {#if operationsMode}
        <p class="text-[0.85rem] text-white-50">
          {m["mirror.operations_mode_hint"]()}
        </p>
      {/if}

      <div class="relative w-full">
        <input
          class="{inputPanel} pr-12"
          type="text"
          placeholder={m["mirror.search_placeholder"]()}
          bind:value={searchQuery}
          onfocus={searchConverters.ensureLoaded}
        />
        {#if searchQuery.trim().length > 0}
          <button
            class={btnInputClear}
            type="button"
            aria-label={m["common.clear_search"]()}
            onclick={() => (searchQuery = "")}
          >
            ×
          </button>
        {/if}
      </div>
      {#if searchQuery.trim().length > 0 || showProtectedOnly}
        <div class="text-[0.95rem] text-white-60">
          {m["common.matched"]({
            shown: protectedFilteredTables.length,
            total: tables.length,
          })}
        </div>
      {/if}

      {#if isAdmin}
        <div id="mirror-admin" class="scroll-mt-20">
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

      {#if listState.phase === "loading"}
        <LoadingProgress
          variant="indeterminate"
          message={m["mirror.loading"]()}
          title={pageTitle}
        />
      {:else if listState.phase === "error"}
        <div class="message-error my-4">
          {m["common.load_failed_with_error"]({ error: listState.message })}
        </div>
      {:else if listState.phase === "unavailable"}
        <div class="message-error my-4">
          {m["common.load_failed_with_error"]({ error: m["common.unknown_error"]() })}
        </div>
      {:else if groupedByTags.length === 0}
        <div class="text-white-70">
          {showProtectedOnly ? m["mirror.no_match_protected"]() : m["mirror.no_match"]()}
        </div>
      {:else}
        <GroupedTablesSection
          bind:selectedMap
          groups={groupedByTags}
          {adminUi}
          {mirrorPreview}
          showDelete={auth.user !== null}
          {operationsMode}
          {deletingDir}
          ondelete={(item: MirrorTableItem) => void handleDelete(item)}
        />
      {/if}
    </div>
  </div>
{/snippet}

<SelectedTablesPanel {tables} bind:selectedMap {mirrorPreview} {displayOrderUrls} />
<JsonPreview bind:this={mirrorPreview} />

<ConfirmDialog dialog={confirmDialog} />
