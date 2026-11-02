<script module lang="ts">
  // 三槽契约（来源、发布、能力）定义在页面模型；此处 re-export 保持
  // “页面组件是三类表共用的路由面”的阅读入口。
  export type {
    TablePageCapabilities,
    TablePagePublish,
    TablePageSource,
  } from "#lib/data/table-page-model.svelte.js";
</script>

<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import { onMount } from "svelte";

  import CoursePanel from "#lib/components/bms/CoursePanel.svelte";
  import EntriesPanel from "#lib/components/bms/EntriesPanel.svelte";
  import LevelRefTable from "#lib/components/bms/LevelRefTable.svelte";
  import type { TableImportSectionProps } from "#lib/components/bms/TableImportSection.svelte";
  import TableIoPanel from "#lib/components/bms/TableIoPanel.svelte";
  import TableOverviewPanel from "#lib/components/bms/TableOverviewPanel.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import { btnBar, btnGhostMd, btnPrimary, btnPrimaryLarge } from "#lib/constants/ui-classes.js";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import {
    createTableModel,
    type TablePageCapabilities,
    type TablePagePublish,
    type TablePageSource,
  } from "#lib/data/table-page-model.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem } from "#lib/types/ui.js";
  import { formatTitle } from "#lib/utils/title.js";
  import { clipboardFeedback } from "#lib/utils/ui/clipboard.svelte.js";
  import { goto } from "$app/navigation";

  /**
   * 难度表页面（查看与编辑合并为同一路由）：
   * - 查看态为默认，地址即导入地址（meta 由服务端/构建期注入，本页只管渲染）；
   * - 点“编辑”以 ?edit=1 就地切换（浅层路由压入历史，返回键回查看态），
   *   导入区动态加载，查看态包体不背导入器；
   * - 两态共享同一份内存模型：查看态直接渲染未保存的编辑结果（带未保存标识），
   *   分组、统计与段位实时重算；模型（加载、草稿、保存发布）在
   *   data/table-page-model.svelte.ts，本组件持模式切换与模板。
   */
  interface Props {
    /** 来源三槽：见 TablePageSource。 */
    source: TablePageSource;
    /** 发布三槽：保存回调、并发检查与另存共享策略。 */
    publish?: TablePagePublish | undefined;
    /** 能力三槽：写权限、创建态与初始基线。 */
    capabilities?: TablePageCapabilities | undefined;
    /** 标题区操作槽（共享表作者信息、下载、登录）。 */
    actions?: Snippet | undefined;
    /** 编辑态概览区的表管理槽（共享表改 id、删除）。 */
    management?: Snippet | undefined;
  }

  let { source, publish = {}, capabilities = {}, actions, management }: Props = $props();

  // 等级参考的状态属主是本组件：LevelRefTable 自取数并经 bind 回写；
  // 目录与分区显隐直接读取这里的状态。
  let levelRefHasData = $state(false);
  let levelRefLoadState = $state<"idle" | "loading" | "done" | "not-found" | "error">("idle");

  // getter 传递：props 对象经闭包读取，模型内的 $derived 跟踪其响应式变化
  const model = createTableModel({
    source: () => source,
    publish: () => publish,
    capabilities: () => capabilities,
  });
  const headerUrl = $derived(source.headerUrl);
  const showLevelRefPane = $derived(headerUrl !== null && levelRefLoadState !== "not-found");
  const saveAsShared = $derived(publish.saveAsShared ?? "none");
  const sharedMode = $derived(capabilities.mode === "shared");
  const createMode = $derived(capabilities.createMode ?? false);
  const editHint = $derived.by(() => {
    if (createMode) return m["editor.enter_table_hint_create"]();
    if (sharedMode && capabilities.canWrite === true) return m["editor.enter_table_hint_save"]();
    return m["editor.enter_table_hint_local"]();
  });

  // ---- 模式（?edit=1 浅层路由；深链与刷新保持编辑态） ----
  // SvelteKit 的 pushState 只更新历史与 page.state、不更新 page.url，模式因此由
  // 本地状态持有；地址栏是可分享与可刷新的真源，挂载与前进后退经 popstate 同步
  // （预渲染页在构建期不能读查询串，SSR 先渲染查看态，挂载后再进入编辑态）。
  let isEdit = $state(false);

  function syncModeFromLocation(): void {
    isEdit = new URLSearchParams(window.location.search).has("edit");
  }

  function setMode(next: "view" | "edit"): void {
    if (next === "edit" && isEdit) return;
    if (next === "view" && !isEdit) return;
    const url = new URL(window.location.href);

    if (next === "edit") url.searchParams.set("edit", "1");
    else url.searchParams.delete("edit");

    goto(url, { shallow: true });
    isEdit = next === "edit";
  }

  // ---- 导入区按需加载（查看态不载入导入器包体） ----
  let ImportSection = $state<Component<TableImportSectionProps> | null>(null);
  async function ensureImportSection(): Promise<void> {
    if (ImportSection !== null) return;
    const mod = await import("#lib/components/bms/TableImportSection.svelte");
    ImportSection = mod.default;
  }
  $effect(() => {
    if (isEdit) void ensureImportSection();
  });

  // ---- 导入链接（查看态展示当前地址；新建表尚无导入地址） ----
  let importUrl = $state<string | null>(null);
  const cb = clipboardFeedback();
  function copyImportUrl(): void {
    if (importUrl) cb.copy(importUrl);
  }

  // 加载只发起一次：共享表在创建前（headerUrl 为 null）与创建后（拿到 R2 地址）
  // 会经历 prop 变化，但创建后的内存内容就是刚保存的内容，重载只会打断编辑。
  onMount(() => {
    syncModeFromLocation();
    window.addEventListener("popstate", syncModeFromLocation);
    importUrl = `${window.location.origin}${window.location.pathname}`;
    void model.loadHeader();
    return () => window.removeEventListener("popstate", syncModeFromLocation);
  });

  const tocItems = $derived<TocItem[]>(
    model.headerLoadState === "loaded"
      ? [
          { id: "overview", title: m["editor.header_section"](), href: "#overview" },
          { id: "course-list", title: m["editor.course_section"](), href: "#course-list" },
          ...(levelRefHasData
            ? [{ id: "level-ref", title: m["levelref.heading"](), href: "#level-ref" }]
            : []),
          { id: "charts-list", title: m["editor.entries_section"](), href: "#charts-list" },
          {
            id: "import-export",
            title: isEdit ? m["editor.io_section"]() : m["editor.export_section"](),
            href: "#import-export",
          },
        ]
      : []
  );
</script>

<svelte:head>
  <title>{formatTitle(model.pageTitle)}</title>
</svelte:head>

<PageShell
  {tocItems}
  panes={[
    titlePane,
    ...(model.pendingDraft !== null ? [draftBannerPane] : []),
    ...(model.headerLoadState === "loading"
      ? [headerLoadingPane]
      : model.headerLoadState === "error"
        ? [headerErrorPane]
        : [
            overviewPane,
            coursePane,
            ...(showLevelRefPane ? [levelRefPane] : []),
            chartsPane,
            ioPane,
          ]),
  ]}
/>

{#snippet titlePane()}
  <div class="text-center">
    <h1 class="page-title mb-2">{model.pageTitle}</h1>
    {#if model.symbol.trim() !== ""}
      <div class="text-[1.2rem] text-white-70 italic">
        {m["table.symbol"]({ symbol: model.symbol })}
      </div>
    {/if}
    {#if !createMode}
      <div class="mt-2 text-[1.2rem] text-white-70 italic">
        {m["table.import_hint"]()}
        {#if importUrl}
          <span class="font-mono text-[0.95rem] break-all text-white-85">{importUrl}</span>
          <button class="link-accent" type="button" onclick={copyImportUrl}>
            {m["common.click_copy"]()}
          </button>
        {:else}
          <span class="text-white-50">{m["table.reading"]()}</span>
        {/if}
        {#if cb.copied}
          <span class="ml-2 text-[#4caf50]">{m["common.copied"]()}</span>
        {/if}
      </div>
    {/if}
    {#if isEdit && sharedMode && capabilities.canWrite !== true}
      <div
        class="mx-auto mt-3 max-w-3xl rounded-lg border border-white-15 bg-black-20 px-3 py-2 text-[0.9rem] text-white-65"
      >
        {m["editor.shared_local_hint"]()}
      </div>
    {/if}
    {#if model.ready && actions}
      <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
        {@render actions()}
      </div>
    {/if}
    {#if isEdit}
      <div class="mt-2 flex flex-wrap items-center justify-center gap-2">
        {#if !createMode}
          <button class={btnBar} type="button" onclick={() => setMode("view")}>
            {m["editor.view"]()}
          </button>
        {/if}
        {#if model.ready && model.canSave}
          <button
            class={btnPrimary}
            type="button"
            disabled={model.busy}
            onclick={() => void model.save()}
          >
            {model.saveLabel}
          </button>
        {/if}
        {#if model.ready && saveAsShared !== "none"}
          <button
            class={btnGhostMd}
            type="button"
            disabled={model.busy}
            onclick={() => void model.saveAsSharedNow()}
          >
            {m["editor.save_as_shared"]()}
          </button>
        {/if}
      </div>
    {:else if model.ready}
      <div class="mt-3 flex flex-col items-center gap-1.5">
        <button class={btnPrimary} type="button" onclick={() => setMode("edit")}>
          {model.dirty ? m["editor.continue_edit"]() : m["editor.enter_table"]()}
        </button>
        <p class="max-w-3xl text-[0.85rem] text-white-50">{editHint}</p>
      </div>
    {/if}
    {#if model.ready}
      {#if model.dirty}
        <div class="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span class="text-amber-300">{m["editor.unsaved_badge"]()}</span>
          {#if !isEdit && model.canSave}
            <button
              class={btnPrimary}
              type="button"
              disabled={model.busy}
              onclick={() => void model.save()}
            >
              {model.saveLabel}
            </button>
          {/if}
          <button
            class={btnGhostMd}
            type="button"
            disabled={model.busy}
            onclick={() => void model.discardEdits()}
          >
            {m["editor.discard_unsaved"]()}
          </button>
        </div>
      {/if}
    {/if}
    {#if isEdit && model.ready && model.draftStatusText !== ""}
      <div class="mt-2 text-[0.85rem] text-white-50">{model.draftStatusText}</div>
    {/if}
    {#if model.ready && model.tableStats}
      <div class="mt-2 text-[1.2rem] text-white-70 italic">
        {m["table.stats"]({
          total: model.tableStats.totalCharts,
          difficulties: model.tableStats.difficulties.length,
        })}
      </div>
    {/if}
    {#if model.notice !== null}
      <div
        class="mx-auto mt-3 max-w-3xl rounded-lg border px-3 py-2 text-[0.9rem] {model.notice
          .kind === 'ok'
          ? 'border-[#4caf50]/40 bg-[#4caf50]/10 text-[#a5d6a7]'
          : model.notice.kind === 'warn'
            ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
            : 'border-red-400/40 bg-red-400/10 text-red-200'}"
      >
        {model.notice.text}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet draftBannerPane()}
  {#if model.pendingDraft !== null}
    <div class="py-2 text-center">
      <p class="text-[1.05rem] text-amber-200">{m["editor.draft_found_title"]()}</p>
      <p class="mx-auto mt-2 max-w-120 text-[0.9rem] text-white-65">
        {m["editor.draft_found_desc"]({ time: model.formatClock(model.pendingDraft.savedAt) })}
      </p>
      <div class="mt-4 flex flex-wrap justify-center gap-3">
        <button class={btnPrimary} type="button" onclick={model.restorePendingDraft}>
          {m["editor.draft_restore"]()}
        </button>
        <button class={btnGhostMd} type="button" onclick={() => void model.discardPendingDraft()}>
          {m["editor.draft_discard"]()}
        </button>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet headerLoadingPane()}
  <div class="p-8">
    <LoadingProgress
      title={m["table.loading_data_title"]()}
      message={m["table.loading_header_request"]()}
      progress={0}
      variant="indeterminate"
    />
  </div>
{/snippet}

{#snippet headerErrorPane()}
  {@render errorDisplayPane(
    m["common.load_failed"](),
    model.headerError ?? m["common.unknown_error"](),
    m["common.check_network"](),
    m["common.reload"](),
    model.retryAll
  )}
{/snippet}

{#snippet errorDisplayPane(
  title: string,
  message: string,
  tip: string,
  buttonLabel: string,
  onRetry: () => void | Promise<void>
)}
  <div class="p-12 text-center">
    <div class="mb-4 text-[4rem]">⚠️</div>
    <h3 class="mb-4 text-error">{title}</h3>
    <p class="message-error my-6">
      {message}
    </p>
    <p class="mb-6 text-white-70">{tip}</p>
    <button class={btnPrimaryLarge} type="button" onclick={() => void onRetry()}>
      {buttonLabel}
    </button>
  </div>
{/snippet}

{#snippet overviewPane()}
  <TableOverviewPanel
    editing={isEdit}
    bind:name={model.name}
    bind:symbol={model.symbol}
    bind:tag={model.tag}
    bind:headerMode={model.headerMode}
    bind:levels={model.levels}
    extraHeader={model.extraHeader}
    disabled={isEdit ? model.busy || model.dataLoadState !== "loaded" : false}
    {management}
    onChange={model.markDirty}
  />
{/snippet}

{#snippet coursePane()}
  <CoursePanel
    id="course-list"
    editing={isEdit}
    groups={model.courseGroups}
    bind:model={model.courseModel}
    entries={model.entries}
    symbol={model.symbol}
    nested={model.courseModel.shape === "nested"}
    disabled={isEdit ? model.busy || model.dataLoadState !== "loaded" : false}
    initiallyCollapsed={true}
    onChange={model.markDirty}
  />
{/snippet}

{#snippet levelRefPane()}
  <DetailsPanel
    id="level-ref"
    class="scroll-mt-20"
    summary={m["levelref.heading"]()}
    variant="plain"
  >
    <LevelRefTable
      headerUrl={headerUrl ?? ""}
      bind:hasData={levelRefHasData}
      bind:loadState={levelRefLoadState}
    />
  </DetailsPanel>
{/snippet}

{#snippet chartsPane()}
  <EntriesPanel
    editing={isEdit}
    bind:entries={model.entries}
    levels={model.levels}
    symbol={model.symbol}
    levelHints={model.levelHints}
    disabled={isEdit ? model.busy || model.dataLoadState !== "loaded" : false}
    loadState={model.dataLoadState}
    loadMessage={model.loadMessage}
    loadPercent={model.loadPercent}
    loadDetail={model.loadDetail}
    dataError={model.dataError}
    onRetry={model.retryData}
    onChange={model.markDirty}
  />
{/snippet}

{#snippet ioPane()}
  <TableIoPanel
    editing={isEdit}
    {headerUrl}
    dataUrl={model.dataFetchUrl}
    onExport={model.exportTable}
    exportDisabled={model.dataLoadState !== "loaded"}
    importSection={isEdit ? importSection : undefined}
  />
{/snippet}

{#snippet importSection()}
  {#if ImportSection !== null}
    {@const Section = ImportSection}
    <Section
      bind:name={model.name}
      bind:symbol={model.symbol}
      bind:tag={model.tag}
      bind:headerMode={model.headerMode}
      bind:levels={model.levels}
      bind:extraHeader={model.extraHeader}
      bind:courseModel={model.courseModel}
      bind:entries={model.entries}
      bind:levelHints={model.levelHints}
      disabled={model.busy || model.dataLoadState !== "loaded"}
      onChange={model.markDirty}
      onNotice={(value: EditorNotice | null) => (model.notice = value)}
    />
  {/if}
{/snippet}
