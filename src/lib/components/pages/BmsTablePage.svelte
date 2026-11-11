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
  import type { BmsDropResult } from "@brightmeows/bms/editor";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Copy from "@lucide/svelte/icons/copy";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { Component, Snippet } from "svelte";
  import { onMount, tick } from "svelte";

  import BmsDropOverlay from "#lib/components/bms/BmsDropOverlay.svelte";
  import CoursePanel from "#lib/components/bms/CoursePanel.svelte";
  import EntriesPanel from "#lib/components/bms/EntriesPanel.svelte";
  import LevelRefTable from "#lib/components/bms/LevelRefTable.svelte";
  import TableDock from "#lib/components/bms/TableDock.svelte";
  import type { TableImportSectionProps } from "#lib/components/bms/TableImportSection.svelte";
  import TableOverviewPanel from "#lib/components/bms/TableOverviewPanel.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import CardSwitcher, { type CardSwitchItem } from "#lib/components/ui/CardSwitcher.svelte";
  import { createConfirmDialog } from "#lib/components/ui/confirm-dialog.svelte.js";
  import ConfirmDialog from "#lib/components/ui/ConfirmDialog.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import { btnGhost, btnPrimaryLarge } from "#lib/constants/ui-classes.js";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import type { DockMode } from "#lib/controllers/table-dock.js";
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

  /** 玻璃确认弹层：本页唯一实例，模型与编辑面板共用同一确认原语。 */
  const confirmDialog = createConfirmDialog();

  // getter 传递：props 对象经闭包读取，模型内的 $derived 跟踪其响应式变化
  const model = createTableModel({
    source: () => source,
    publish: () => publish,
    capabilities: () => capabilities,
    confirm: () => confirmDialog.ask,
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

  /**
   * dock 的模式切换：切换后滚回页首，让标题区与分区变化（导入区动态加载、
   * CardSwitcher 分区增减）进入视口；reduced-motion 时瞬时跳转。
   */
  function handleDockSetMode(next: DockMode): void {
    setMode(next);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  // ---- 键盘快捷键：Ctrl/Cmd+S 保存，Ctrl/Cmd+E 切换查看/编辑 ----
  function isEditableTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT")
    );
  }

  function handleKeydown(event: KeyboardEvent): void {
    // 确认弹层打开时冻结页面快捷键：待确认操作不得被切模式打断后跨态落地
    if (confirmDialog.open) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (event.key === "s" || event.key === "S") {
      if (!model.canSave || model.busy) return;
      event.preventDefault();
      void model.save();
    } else if (event.key === "e" || event.key === "E") {
      // 文本输入里 Ctrl/Cmd+E 是编辑器光标习惯，不抢
      if (isEditableTarget(event.target)) return;
      // 创建态没有查看分支（表头尚不存在），不切走
      if (createMode && isEdit) return;
      event.preventDefault();
      handleDockSetMode(isEdit ? "view" : "edit");
    }
  }

  /**
   * 全页拖拽导入的追加处理：与导入折叠段拖拽区的追加逻辑一致
   * （追加条目、合并文件等级建议、标记未保存并给出结果通知）。
   */
  function handlePageDrop(result: BmsDropResult): void {
    if (result.added.length > 0) {
      model.entries = [...model.entries, ...result.added];
      model.levelHints = { ...model.levelHints, ...result.hints };
      model.markDirty();
    }
    model.notice = {
      kind: result.added.length > 0 ? "ok" : "warn",
      text: m["editor.bms_drop_done"]({
        added: result.added.length,
        skipped: result.skipped,
        failed: result.failed,
      }),
    };
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
    window.addEventListener("keydown", handleKeydown);
    importUrl = `${window.location.origin}${window.location.pathname}`;
    void model.loadHeader();
    return () => {
      window.removeEventListener("popstate", syncModeFromLocation);
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  type CardId = "overview" | "course-list" | "level-ref" | "charts-list";

  let visibleCards = $state<Record<CardId, boolean>>({
    overview: false,
    "course-list": false,
    "level-ref": false,
    "charts-list": true,
  });
  let hiddenLevels = $state<Set<string>>(new Set());
  let hideUnassigned = $state(false);

  const courseCount = $derived(
    model.courseGroups.reduce((total, group) => total + group.length, 0)
  );
  const cardItems = $derived<CardSwitchItem[]>([
    {
      id: "overview",
      label: m["editor.header_section"](),
      checked: visibleCards.overview,
    },
    {
      id: "course-list",
      label: m["editor.course_section"](),
      checked: visibleCards["course-list"],
      count: courseCount,
    },
    ...(showLevelRefPane
      ? [
          {
            id: "level-ref",
            label: m["levelref.heading"](),
            checked: visibleCards["level-ref"],
          },
        ]
      : []),
    {
      id: "charts-list",
      label: m["editor.entries_section"](),
      checked: visibleCards["charts-list"],
      count: model.entries.length,
    },
  ]);

  function toggleCard(id: string, checked: boolean): void {
    visibleCards = { ...visibleCards, [id as CardId]: checked };
  }

  async function jumpToCard(id: string): Promise<void> {
    const cardId = id as CardId;
    if (!visibleCards[cardId]) {
      visibleCards = { ...visibleCards, [cardId]: true };
      await tick();
    }
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  const tocItems = $derived<TocItem[]>(
    model.headerLoadState === "loaded"
      ? [
          ...(visibleCards.overview
            ? [{ id: "overview", title: m["editor.header_section"](), href: "#overview" }]
            : []),
          ...(visibleCards["course-list"]
            ? [{ id: "course-list", title: m["editor.course_section"](), href: "#course-list" }]
            : []),
          ...(visibleCards["level-ref"] && levelRefHasData
            ? [{ id: "level-ref", title: m["levelref.heading"](), href: "#level-ref" }]
            : []),
          ...(visibleCards["charts-list"]
            ? [
                {
                  id: "charts-list",
                  title: m["editor.entries_section"](),
                  href: "#charts-list",
                },
              ]
            : []),
        ]
      : []
  );
</script>

<svelte:head>
  <title>{formatTitle(model.pageTitle)}</title>
</svelte:head>

<!-- mainClass 覆盖默认 pb-8：底部为操作 dock 的右下角面板留出空间 -->
<PageShell
  mainClass="m-0 mx-auto box-border w-full max-w-350 px-8 pt-24 pb-40"
  {tocItems}
  panes={[
    titlePane,
    ...(model.headerLoadState === "loading"
      ? [headerLoadingPane]
      : model.headerLoadState === "error"
        ? [headerErrorPane]
        : [
            ...(visibleCards.overview ? [overviewPane] : []),
            ...(visibleCards["course-list"] ? [coursePane] : []),
            ...(visibleCards["level-ref"] && showLevelRefPane ? [levelRefPane] : []),
            ...(visibleCards["charts-list"] ? [chartsPane] : []),
          ]),
  ]}
/>

<!-- 底部操作 dock：模式切换、保存与动态状态自标题区迁入；ready 前不渲染 -->
{#if model.ready}
  <TableDock
    {model}
    mode={isEdit ? "edit" : "view"}
    {createMode}
    showSaveAsShared={saveAsShared !== "none"}
    {editHint}
    {tableActions}
    importSection={isEdit ? importSection : undefined}
    onSetMode={handleDockSetMode}
  />
{/if}

<ConfirmDialog dialog={confirmDialog} />

<!-- 编辑态全页拖拽接收：与导入折叠段的拖拽区共用同一管线 -->
{#if isEdit && model.ready}
  <BmsDropOverlay
    entries={model.entries}
    disabled={model.busy || model.dataLoadState !== "loaded"}
    onadd={handlePageDrop}
  />
{/if}

<!-- 表操作折叠段：导出、查看原文与 fork（fork 仅查看态；编辑态另存共享在按钮区） -->
{#snippet tableActions()}
  <button
    class="{btnGhost} w-full"
    type="button"
    disabled={model.dataLoadState !== "loaded"}
    onclick={() => model.exportTable("header")}
  >
    <Download class="size-4 shrink-0" aria-hidden="true" />
    {m["editor.export_header"]()}
  </button>
  <button
    class="{btnGhost} w-full"
    type="button"
    disabled={model.dataLoadState !== "loaded"}
    onclick={() => model.exportTable("data")}
  >
    <Download class="size-4 shrink-0" aria-hidden="true" />
    {m["editor.export_data"]()}
  </button>
  <button
    class="{btnGhost} w-full"
    type="button"
    disabled={model.dataLoadState !== "loaded"}
    onclick={() => model.exportTable("package")}
  >
    <Download class="size-4 shrink-0" aria-hidden="true" />
    {m["editor.export_package"]()}
  </button>
  {#if headerUrl !== null}
    <a class="{btnGhost} w-full" href={headerUrl} target="_blank" rel="noopener noreferrer">
      <ExternalLink class="size-4 shrink-0" aria-hidden="true" />
      {m["table.view_header"]()}
    </a>
  {/if}
  {#if model.dataFetchUrl !== null}
    <a
      class="{btnGhost} w-full"
      href={model.dataFetchUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ExternalLink class="size-4 shrink-0" aria-hidden="true" />
      {m["table.view_data"]()}
    </a>
  {/if}
  <a
    class="{btnGhost} w-full"
    href="https://github.com/brightmeows/bms-skills/blob/main/skills/bms-table/SKILL.md"
    target="_blank"
    rel="noopener noreferrer"
  >
    <BookOpen class="size-4 shrink-0" aria-hidden="true" />
    {m["table.format_reference"]()}
  </a>
  {#if !isEdit && saveAsShared === "same-origin"}
    <button
      class="{btnGhost} w-full"
      type="button"
      disabled={model.busy}
      onclick={() => void model.saveAsSharedNow()}
    >
      <Copy class="size-4 shrink-0" aria-hidden="true" />
      {sharedMode ? m["shared.fork"]() : m["editor.save_as_shared"]()}
    </button>
  {/if}
{/snippet}

{#snippet titlePane()}
  <div class="flex flex-col items-center gap-3 text-center">
    <h1 class="page-title m-0 flex w-full justify-center">
      {#if isEdit}
        <input
          class="w-full rounded-md bg-transparent text-center outline-none [font:inherit] placeholder:text-white-30 focus-visible:ring-2 focus-visible:ring-accent/40"
          type="text"
          bind:value={model.name}
          placeholder={model.pageTitle}
          disabled={model.busy || model.dataLoadState !== "loaded"}
          aria-label={m["editor.field_name"]()}
          oninput={() => model.markDirty()}
        />
      {:else}
        {model.pageTitle}
      {/if}
    </h1>
    {#if model.symbol.trim() !== ""}
      <div class="text-[1.1rem] text-white-70 italic">
        {m["table.symbol"]({ symbol: model.symbol })}
      </div>
    {/if}

    <div
      class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[0.9rem] text-white-60"
    >
      {#if model.ready && model.tableStats}
        <span>
          {m["table.stats"]({
            total: model.tableStats.totalCharts,
            difficulties: model.tableStats.difficulties.length,
          })}
        </span>
      {/if}
      {#if !createMode}
        {#if model.ready && model.tableStats}
          <span class="text-white-40">·</span>
        {/if}
        <span>{m["table.import_url_short"]()}</span>
        {#if importUrl}
          <span class="max-w-full font-mono text-[0.85rem] break-all text-white-75">
            {importUrl}
          </span>
          <button class="link-accent text-[0.85rem]" type="button" onclick={copyImportUrl}>
            {m["common.click_copy"]()}
          </button>
        {:else}
          <span class="text-white-50">{m["table.reading"]()}</span>
        {/if}
        {#if cb.copied}
          <span class="text-success">{m["common.copied"]()}</span>
        {/if}
      {/if}
    </div>

    {#if model.ready && actions}
      <div class="flex flex-wrap items-center justify-center gap-2">
        {@render actions()}
      </div>
    {/if}

    {#if isEdit && sharedMode && capabilities.canWrite !== true}
      <p
        class="rounded-lg border border-white-15 bg-black-20 px-3 py-2 text-[0.85rem] text-white-65"
      >
        {m["editor.shared_local_hint"]()}
      </p>
    {/if}

    <CardSwitcher
      items={cardItems}
      ariaLabel={m["table.sections"]()}
      align="center"
      onToggle={toggleCard}
      onJump={(id) => void jumpToCard(id)}
    />
  </div>
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
    <TriangleAlert class="mx-auto mb-4 size-16 text-error" strokeWidth={1.5} aria-hidden="true" />
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
  <div id="overview" class="scroll-mt-20">
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
      onNotice={(value: EditorNotice) => (model.notice = value)}
    />
  </div>
{/snippet}

{#snippet coursePane()}
  <div id="course-list" class="scroll-mt-20">
    <CoursePanel
      editing={isEdit}
      groups={model.courseGroups}
      bind:model={model.courseModel}
      entries={model.entries}
      symbol={model.symbol}
      nested={model.courseModel.shape === "nested"}
      disabled={isEdit ? model.busy || model.dataLoadState !== "loaded" : false}
      onChange={model.markDirty}
      onNotice={(value: EditorNotice) => (model.notice = value)}
    />
  </div>
{/snippet}

{#snippet levelRefPane()}
  <div id="level-ref" class="scroll-mt-20">
    <LevelRefTable
      headerUrl={headerUrl ?? ""}
      bind:hasData={levelRefHasData}
      bind:loadState={levelRefLoadState}
    />
  </div>
{/snippet}

{#snippet chartsPane()}
  <div id="charts-list" class="scroll-mt-20">
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
      onNotice={(value: EditorNotice) => (model.notice = value)}
      confirm={confirmDialog.ask}
      bind:hiddenLevels
      bind:hideUnassigned
    />
  </div>
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
      confirm={confirmDialog.ask}
    />
  {/if}
{/snippet}
