<script module lang="ts">
  // 三槽契约（来源、发布、能力）定义在页面模型；此处 re-export 保持
  // “页面组件是三类表共用的路由面”的阅读入口。
  export type {
    TablePageCapabilities,
    TablePagePublish,
    TablePageSource,
  } from "$lib/data/table-page-model.svelte";
</script>

<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import { onMount } from "svelte";

  import { pushState } from "$app/navigation";
  import ChartsTableSection from "$lib/components/bms/ChartsTableSection.svelte";
  import CourseSection from "$lib/components/bms/CourseSection.svelte";
  import LevelRefTable from "$lib/components/bms/LevelRefTable.svelte";
  import type { TableEditContentProps } from "$lib/components/bms/TableEditContent.svelte";
  import TableEditToc from "$lib/components/bms/TableEditToc.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { btnBar, btnGhostMd, btnPrimary, btnPrimaryLarge } from "$lib/constants/ui-classes";
  import type { EditorNotice } from "$lib/controllers/editor";
  import {
    createTableModel,
    type TablePageCapabilities,
    type TablePagePublish,
    type TablePageSource,
  } from "$lib/data/table-page-model.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { formatTitle } from "$lib/utils/title";
  import { clipboardFeedback } from "$lib/utils/ui/clipboard.svelte";

  /**
   * 难度表页面（查看与编辑合并为同一路由）：
   * - 查看态为默认，地址即导入地址（meta 由服务端/构建期注入，本页只管渲染）；
   * - 点“编辑”以 ?edit=1 就地切换（浅层路由压入历史，返回键回查看态），
   *   编辑界面动态加载，查看态包体不背编辑器；
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

  // getter 传递：props 对象经闭包读取，模型内的 $derived 跟踪其响应式变化
  const model = createTableModel({
    source: () => source,
    publish: () => publish,
    capabilities: () => capabilities,
  });
  const headerUrl = $derived(source.headerUrl);
  const saveAsShared = $derived(publish.saveAsShared ?? "none");
  const sharedMode = $derived(capabilities.mode === "shared");
  const createMode = $derived(capabilities.createMode ?? false);

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
    pushState(url, {});
    isEdit = next === "edit";
  }

  // ---- 编辑内容按需加载（查看态不载入编辑器包体） ----
  let EditContent = $state<Component<TableEditContentProps> | null>(null);
  async function ensureEditContent(): Promise<void> {
    if (EditContent !== null) return;
    const mod = await import("$lib/components/bms/TableEditContent.svelte");
    EditContent = mod.default;
  }
  $effect(() => {
    if (isEdit) void ensureEditContent();
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
</script>

<svelte:head>
  <title>{formatTitle(model.pageTitle)}</title>
</svelte:head>

<PageShell
  currentLabel={model.pageTitle}
  tocItems={isEdit ? [] : model.tocItems}
  panes={[
    titlePane,
    ...(model.pendingDraft !== null ? [draftBannerPane] : []),
    ...(isEdit
      ? model.headerLoadState === "loading"
        ? [headerLoadingPane]
        : model.headerLoadState === "error"
          ? [headerErrorPane]
          : model.dataLoadState === "idle" || model.dataLoadState === "loading"
            ? [dataLoadingPane]
            : model.dataLoadState === "error"
              ? [dataErrorPane]
              : [editPane]
      : model.headerLoadState === "loading"
        ? [headerLoadingPane]
        : model.headerLoadState === "error"
          ? [headerErrorPane]
          : [
              ...(model.courseGroups.length > 0 ? [coursePane] : []),
              ...(model.showLevelRefPane ? [levelRefPane] : []),
              ...(model.dataLoadState === "idle" || model.dataLoadState === "loading"
                ? [dataLoadingPane]
                : []),
              ...(model.dataLoadState === "loaded" ? [chartsPane] : []),
              ...(model.dataLoadState === "error" ? [dataErrorPane] : []),
            ]),
  ]}
/>

{#if isEdit && model.ready}
  <TableEditToc
    sections={model.editTocSections}
    levels={model.entryLevelGroups}
    selectedLevels={model.selectedLevels}
    includeUnassigned={model.includeUnassigned}
    onToggleLevel={model.toggleLevel}
    onToggleUnassigned={model.toggleUnassigned}
  />
{/if}

{#snippet titlePane()}
  <div class="text-center">
    <h1 class="page-title mb-2">{model.pageTitle}</h1>
    {#if model.symbol.trim() !== ""}
      <div class="text-[1.2rem] text-white/70 italic">
        {m["table.symbol"]({ symbol: model.symbol })}
      </div>
    {/if}
    {#if !createMode}
      <div class="mt-2 text-[1.2rem] text-white/70 italic">
        {m["table.import_hint"]()}
        {#if importUrl}
          <span class="font-mono text-[0.95rem] break-all text-white/85">{importUrl}</span>
          <button class="link-accent" type="button" onclick={copyImportUrl}>
            {m["common.click_copy"]()}
          </button>
        {:else}
          <span class="text-white/50">{m["table.reading"]()}</span>
        {/if}
        {#if cb.copied}
          <span class="ml-2 text-[#4caf50]">{m["common.copied"]()}</span>
        {/if}
      </div>
      <div class="mt-2 text-[1.2rem] text-white/70 italic">
        {#if headerUrl}
          <a class="link-accent" href={headerUrl} target="_blank" rel="noopener noreferrer">
            {m["table.view_header"]()}
          </a>
        {/if}
        {#if headerUrl && model.dataFetchUrl}
          <span class="mx-2">|</span>
        {/if}
        {#if model.dataFetchUrl}
          <a
            class="link-accent"
            href={model.dataFetchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {m["table.view_data"]()}
          </a>
        {/if}
      </div>
    {/if}
    {#if model.ready}
      <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
        {#if actions}
          {@render actions()}
        {/if}
        {#if isEdit}
          {#if !createMode}
            <button class={btnBar} type="button" onclick={() => setMode("view")}>
              {m["editor.view"]()}
            </button>
          {/if}
          {#if model.canSave}
            <button
              class={btnPrimary}
              type="button"
              disabled={model.busy}
              onclick={() => void model.save()}
            >
              {model.saveLabel}
            </button>
          {/if}
          {#if saveAsShared !== "none"}
            <button
              class={btnGhostMd}
              type="button"
              disabled={model.busy}
              onclick={() => void model.saveAsSharedNow()}
            >
              {saveAsShared === "bridge"
                ? m["editor.bridge_button"]()
                : m["editor.save_as_shared"]()}
            </button>
          {/if}
        {:else}
          <button class={btnBar} type="button" onclick={() => setMode("edit")}>
            {model.dirty ? m["editor.continue_edit"]() : m["editor.enter"]()}
          </button>
          {#if model.dirty && model.canSave}
            <button
              class={btnPrimary}
              type="button"
              disabled={model.busy}
              onclick={() => void model.save()}
            >
              {model.saveLabel}
            </button>
          {/if}
        {/if}
        {#if model.dirty}
          <span class="text-amber-300">{m["editor.unsaved_badge"]()}</span>
          <button
            class={btnGhostMd}
            type="button"
            disabled={model.busy}
            onclick={() => void model.discardEdits()}
          >
            {m["editor.discard_unsaved"]()}
          </button>
        {/if}
      </div>
    {/if}
    {#if isEdit && model.ready && model.draftStatusText !== ""}
      <div class="mt-2 text-[0.85rem] text-white/45">{model.draftStatusText}</div>
    {/if}
    {#if model.ready && model.tableStats}
      <div class="mt-2 text-[1.2rem] text-white/70 italic">
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
      <p class="mx-auto mt-2 max-w-120 text-[0.9rem] text-white/65">
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

{#snippet dataLoadingPane()}
  <div class="p-8">
    <LoadingProgress
      title={m["table.loading_charts"]()}
      message={model.loadMessage}
      progress={model.loadPercent}
      detail={model.loadDetail}
      variant="determinate"
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

{#snippet dataErrorPane()}
  {@render errorDisplayPane(
    m["table.data_load_failed_title"](),
    model.dataError ?? m["common.unknown_error"](),
    m["table.data_load_failed_tip"](),
    m["table.retry_load_charts"](),
    model.retryData
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
    <p class="mb-6 text-white/70">{tip}</p>
    <button class={btnPrimaryLarge} type="button" onclick={() => void onRetry()}>
      {buttonLabel}
    </button>
  </div>
{/snippet}

{#snippet coursePane()}
  <div id="course-list" class="scroll-mt-5">
    <CourseSection groups={model.courseGroups} symbol={model.symbol} />
  </div>
{/snippet}

{#snippet levelRefPane()}
  <div id="level-ref" class="scroll-mt-5">
    <LevelRefTable
      headerUrl={headerUrl ?? ""}
      bind:hasData={model.levelRefHasData}
      bind:loadState={model.levelRefLoadState}
    />
  </div>
{/snippet}

{#snippet chartsPane()}
  <div id="charts-list" class="scroll-mt-5">
    {#if model.sortedDifficultyGroups.length > 0}
      <ChartsTableSection
        groups={model.sortedDifficultyGroups}
        totalCharts={model.entries.length}
        symbol={model.symbol}
      />
    {:else}
      <EmptyState title={m["table.no_charts_title"]()} description={m["table.no_charts_desc"]()} />
    {/if}
  </div>
{/snippet}

{#snippet editPane()}
  {#if EditContent !== null}
    {@const Content = EditContent}
    <Content
      bind:name={model.name}
      bind:symbol={model.symbol}
      bind:tag={model.tag}
      bind:headerMode={model.headerMode}
      bind:levels={model.levels}
      bind:extraHeader={model.extraHeader}
      bind:courseModel={model.courseModel}
      bind:entries={model.entries}
      bind:levelHints={model.levelHints}
      busy={model.busy}
      levelFilter={model.levelFilter}
      bridge={saveAsShared === "bridge"}
      localOnly={sharedMode && !capabilities.canWrite}
      onChange={model.markDirty}
      onNotice={(value: EditorNotice | null) => (model.notice = value)}
      onExport={model.exportTable}
      {management}
      levelRef={levelRefSnippet}
    />
  {:else}
    <div class="p-8">
      <LoadingProgress
        title={m["editor.page_title"]()}
        message={m["editor.loading"]()}
        progress={0}
        variant="indeterminate"
      />
    </div>
  {/if}
{/snippet}

{#snippet levelRefSnippet()}
  <section id="level-ref" class="scroll-mt-24">
    <LevelRefTable
      headerUrl={headerUrl ?? ""}
      bind:hasData={model.levelRefHasData}
      bind:loadState={model.levelRefLoadState}
    />
  </section>
{/snippet}
