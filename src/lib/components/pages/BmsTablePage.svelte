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
  /**
   * 难度表页面协议：三类表共用一个路由面（地址即导入地址），主按钮按权限取舍
   * （作者编辑、admin 本地编辑；镜像、他人共享与自托管非 admin 无主按钮，
   * 创建副本作为小按钮收在 dock 菜单的表操作段），?edit=1 浅层路由就地切换编辑态。
   * 页面持有唯一一份内存模型与两段式加载（header 先行、data 随后、草稿探查殿后）；
   * data 未就绪时只读（主按钮禁用、副本入口不出现），data 失败可从菜单恢复本地草稿。
   * 三张工作卡：头部（含等级参考折叠区）、谱面、段位；查看态原生 details 折叠且
   * 默认只展开谱面，编辑态 TableCardBar 管理可见卡（?show= 逗号列表记录组合，
   * 编辑态用 sessionStorage 记住上次组合）。标题区 hero 承载标题、符号 meta 与
   * 一行常用动作（复制导入链接、查看 header.json、查看 data.json，走 btnGhostMd，
   * 复制按钮以原生 title 携带完整导入地址，导入地址不明文展示）。notice：成功类
   * 短时自动清除（时长见常量），warn/error 常驻到被替换。保存闸门：save/
   * saveAsSharedNow/Ctrl+S 都以 data 就绪为前置（加载中 entries 为空，误保存会
   * 清空共享表）。shared 模式接入整包保存（发布前必须全部指派，保存前比对线上
   * updated_at 并发提示）与同源草稿认领另存；放弃未保存修改在两态都可用。
   * 编辑会话历史（撤销/重做，模型见 table-model-history）：输入框外 Ctrl+Z 与
   * Ctrl+Shift+Z 及 dock 面板按钮；脏标记由基线比较派生，回基线即视为无未保存
   * 修改（保存按钮隐去、旧草稿清掉）；保存成功清栈，undo 不可撤回已落库内容。
   */
  import type { BmsDropResult } from "@brightmeows/bms/editor";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { Component, Snippet } from "svelte";
  import { onMount, tick } from "svelte";

  import BmsDropOverlay from "#lib/components/bms/BmsDropOverlay.svelte";
  import CoursePanel from "#lib/components/bms/CoursePanel.svelte";
  import EntriesPanel from "#lib/components/bms/EntriesPanel.svelte";
  import TableCardBar, { type TableCardBarItem } from "#lib/components/bms/TableCardBar.svelte";
  import TableDock from "#lib/components/bms/TableDock.svelte";
  import type { TableImportSectionProps } from "#lib/components/bms/TableImportSection.svelte";
  import TableOverviewPanel from "#lib/components/bms/TableOverviewPanel.svelte";
  import PageHero from "#lib/components/layout/PageHero.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import { createConfirmDialog } from "#lib/components/ui/confirm-dialog.svelte.js";
  import ConfirmDialog from "#lib/components/ui/ConfirmDialog.svelte";
  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import {
    badgeCountSm,
    btnGhost,
    btnGhostMd,
    btnPrimaryLarge,
  } from "#lib/constants/ui-classes.js";
  import type { EditorNotice } from "#lib/controllers/editor.js";
  import {
    defaultCardShow,
    defaultViewSections,
    ensureVisibleCards,
    isTableCardId,
    parseCardShow,
    serializeCardShow,
    setCardShow,
    setSectionOpen,
    type TableCardId,
  } from "#lib/controllers/table-cards.js";
  import type { DockMode } from "#lib/controllers/table-dock.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
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
    /** 标题区操作槽（共享表作者信息、提示文本）。 */
    actions?: Snippet | undefined;
    /** 编辑态概览区的表管理槽（共享表改 id、删除）。 */
    management?: Snippet | undefined;
    /** 菜单里的管理员操作槽（他人共享表的删除）。 */
    adminActions?: Snippet | undefined;
  }

  let {
    source,
    publish = {},
    capabilities = {},
    actions,
    management,
    adminActions,
  }: Props = $props();

  // 等级参考的状态属主是本组件：LevelRefTable 自取数并经 bind 回写；
  // 目录与分区显隐直接读取这里的状态。
  let levelRefHasData = $state(false);
  let levelRefLoadState = $state<"idle" | "loading" | "done" | "not-found" | "error">("idle");

  /** 玻璃确认弹层：本页唯一实例，模型与编辑面板共用同一确认原语。 */
  const confirmDialog = createConfirmDialog();

  /** 副本意图：查看与编辑共享，保存时跳到新建页创建副本。 */
  let copyIntent = $state(false);

  // getter 传递：props 对象经闭包读取，模型内的 $derived 跟踪其响应式变化
  const model = createTableModel({
    source: () => source,
    publish: () => publish,
    capabilities: () => ({ ...capabilities, copyMode: copyIntent }),
    confirm: () => (message: string) => confirmDialog.ask(message, { destructive: true }),
  });
  const headerUrl = $derived(source.headerUrl);

  // 来源切换（共享表新建后拿到 R2 地址等）时重置等级参考状态，
  // 让 TableOverviewPanel 重新挂载 LevelRefTable 请求新来源。
  $effect(() => {
    void headerUrl;
    levelRefLoadState = "idle";
  });

  const saveAsShared = $derived(publish.saveAsShared ?? "none");
  const sharedMode = $derived(capabilities.mode === "shared");
  const createMode = $derived(capabilities.createMode ?? false);
  const dataReady = $derived(model.dataReady);
  const headerReady = $derived(model.headerReady);
  const copyMode = $derived(copyIntent);
  const isAdmin = $derived(auth.status === "ready" && auth.user?.role === "admin");
  const primaryKind = $derived.by(() => {
    if (createMode) return "edit";
    if (sharedMode && capabilities.canWrite === true) return "edit";
    if (model.kind === "self" && isAdmin) return "local";
    return "copy";
  });
  const primaryLabel = $derived.by(() => {
    if (model.dirty) {
      return primaryKind === "copy"
        ? m["editor.permission.continue_copy"]()
        : m["editor.dock.continue_edit"]();
    }
    if (primaryKind === "copy") return m["editor.permission.create_copy"]();
    if (primaryKind === "local") return m["editor.permission.local_edit"]();
    return m["editor.enter.table"]();
  });
  /** 副本场景（镜像、他人共享、自托管非 admin）不渲染主按钮，入口收进表操作段。 */
  const showDockPrimary = $derived(primaryKind !== "copy");
  const editHint = $derived.by(() => {
    if (copyMode || primaryKind === "copy") return m["editor.enter.table_hint_copy"]();
    if (createMode) return m["editor.enter.table_hint_create"]();
    if (sharedMode && capabilities.canWrite === true) return m["editor.enter.table_hint_save"]();
    return m["editor.enter.table_hint_local"]();
  });

  // ---- 模式（?edit=1 浅层路由；深链与刷新保持编辑态） ----
  // SvelteKit 的 pushState 只更新历史与 page.state、不更新 page.url，模式因此由
  // 本地状态持有；地址栏是可分享与可刷新的真源，挂载与前进后退经 popstate 同步
  // （预渲染页在构建期不能读查询串，SSR 先渲染查看态，挂载后再进入编辑态）。
  let isEdit = $state(false);

  function syncModeFromLocation(): void {
    const params = new URLSearchParams(window.location.search);
    isEdit = params.has("edit");
    copyIntent = params.has("copy");
  }

  function setMode(next: "view" | "edit", options?: { copy?: boolean }): void {
    if (next === "view" && !isEdit) return;
    const nextCopy = options?.copy ?? copyIntent;
    const url = new URL(window.location.href);

    if (next === "edit") {
      url.searchParams.set("edit", "1");
      const fallback =
        readStoredCards() ??
        defaultCardShow({
          dataReady: model.dataReady,
          isNew: createMode,
          headerUnfilled: model.headerUnfilled,
        });
      const nextCards = ensureVisibleCards(cards, fallback);
      if (nextCards.length !== cards.length || nextCards.some((id, index) => id !== cards[index])) {
        cards = nextCards;
        try {
          sessionStorage.setItem(cardStorageKey, serializeCardShow(nextCards));
        } catch {
          // 隐私模式下 sessionStorage 可能不可用；URL 仍保留组合
        }
      }
      url.searchParams.set("show", serializeCardShow(cards));
    } else {
      url.searchParams.delete("edit");
    }
    if (nextCopy) url.searchParams.set("copy", "1");
    else url.searchParams.delete("copy");

    goto(url, { shallow: true });
    isEdit = next === "edit";
    copyIntent = nextCopy;
  }

  /**
   * dock 的模式切换：切换后滚回页首，让标题区与分区变化（导入区动态加载、
   * 卡片显隐或查看态展开变化）进入视口；reduced-motion 时瞬时跳转。
   */
  function handleDockSetMode(next: DockMode, options?: { copy?: boolean }): void {
    setMode(next, options);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  /** 查看态主按钮与表操作段副本入口的回调：编辑、本地编辑或进入副本编辑。 */
  function handlePrimary(): void {
    if (!dataReady) return;
    handleDockSetMode("edit", { copy: primaryKind === "copy" });
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
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key === "s" || event.key === "S") {
      if (event.shiftKey) return;
      if (!model.canSave || model.busy) return;
      event.preventDefault();
      void model.save();
    } else if (event.key === "e" || event.key === "E") {
      if (event.shiftKey) return;
      // 文本输入里 Ctrl/Cmd+E 是编辑器光标习惯，不抢
      if (isEditableTarget(event.target)) return;
      // 创建态没有查看分支（表头尚不存在），不切走
      if (createMode && isEdit) return;
      event.preventDefault();
      handleDockSetMode(isEdit ? "view" : "edit");
    } else if (event.key === "z" || event.key === "Z") {
      // 文本输入框内留原生文本撤销（只还原本字段文本，bind 链路自洽）；
      // 模型栈撤销在输入框外响应，撤的是“操作”
      if (isEditableTarget(event.target)) return;
      if (!isEdit) return;
      event.preventDefault();
      if (event.shiftKey) {
        model.redo();
      } else {
        model.undo();
      }
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
      text: m["editor.drop.done"]({
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

  let hashTarget = $state("");

  // 加载只发起一次：共享表在创建前（headerUrl 为 null）与创建后（拿到 R2 地址）
  // 会经历 prop 变化，但创建后的内存内容就是刚保存的内容，重载只会打断编辑。
  onMount(() => {
    syncModeFromLocation();
    syncCardsFromLocation();
    const syncLocation = (): void => {
      syncModeFromLocation();
      syncCardsFromLocation({ writeUrl: false });
    };
    const syncHash = (): void => {
      hashTarget = window.location.hash;
      if (sectionFromHash(hashTarget) === null) handledHash = "";
    };
    syncHash();
    window.addEventListener("popstate", syncLocation);
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("keydown", handleKeydown);
    importUrl = `${window.location.origin}${window.location.pathname}`;
    void auth.ensureLoaded();
    void model.loadHeader();
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  type CardAnchor = "overview" | "charts-list" | "course-list";

  const CARD_ANCHORS: Record<TableCardId, CardAnchor> = {
    header: "overview",
    charts: "charts-list",
    course: "course-list",
  };

  const CARD_STORAGE_PREFIX = "bms.table.cards.";
  const cardStorageKey = $derived(`${CARD_STORAGE_PREFIX}${source.draftKey}`);

  let cards = $state<TableCardId[]>([]);
  let addDrawerOpen = $state(false);
  let hiddenLevels = $state<Set<string>>(new Set());
  let hideUnassigned = $state(false);

  const courseCount = $derived(
    model.courseGroups.reduce((total, group) => total + group.length, 0)
  );

  /** 卡的计数；data 未就绪时不显示。 */
  function sectionCount(id: TableCardId): number | undefined {
    if (!dataReady) return undefined;
    if (id === "charts") return model.entries.length;
    if (id === "course") return courseCount;
    return undefined;
  }

  const cardBarItems = $derived<TableCardBarItem[]>([
    {
      id: "header",
      label: m["editor.frame.header"](),
      visible: cards.includes("header"),
      anchor: "overview",
    },
    {
      id: "charts",
      label: m["editor.entries.section"](),
      visible: cards.includes("charts"),
      anchor: "charts-list",
      count: sectionCount("charts"),
    },
    {
      id: "course",
      label: m["editor.course.section"](),
      visible: cards.includes("course"),
      anchor: "course-list",
      count: sectionCount("course"),
    },
  ]);

  function readStoredCards(): TableCardId[] | null {
    try {
      return parseCardShow(sessionStorage.getItem(cardStorageKey));
    } catch {
      return null;
    }
  }

  function writeCardsUrl(next: readonly TableCardId[]): void {
    const url = new URL(window.location.href);
    url.searchParams.set("show", serializeCardShow(next));
    void goto(url, { shallow: true, replace: true });
  }

  /** 查看态只更新展开集合，不写 URL 与 sessionStorage；编辑态持久化显隐。 */
  function applyCards(next: readonly TableCardId[], options?: { persist?: boolean }): void {
    cards = [...next];
    if (options?.persist === false) return;
    try {
      sessionStorage.setItem(cardStorageKey, serializeCardShow(cards));
    } catch {
      // 隐私模式下 sessionStorage 可能不可用；URL 仍保留组合
    }
    writeCardsUrl(cards);
  }

  function syncCardsFromLocation(options?: { writeUrl?: boolean }): void {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = parseCardShow(params.get("show"));

    if (isEdit) {
      const stored = fromUrl === null ? readStoredCards() : null;
      const initial =
        fromUrl ??
        stored ??
        defaultCardShow({
          dataReady: model.dataReady,
          isNew: createMode,
          headerUnfilled: model.headerUnfilled,
        });
      cards = initial;
      try {
        sessionStorage.setItem(cardStorageKey, serializeCardShow(initial));
      } catch {
        // 同上
      }
      if (fromUrl === null && options?.writeUrl !== false) writeCardsUrl(initial);
      return;
    }

    // 查看态把旧 ?show= 当作初始展开集合，随后从地址栏清掉：折叠状态不持久化。
    cards = fromUrl ?? defaultViewSections();
    if (fromUrl !== null) {
      const url = new URL(window.location.href);
      url.searchParams.delete("show");
      history.replaceState(history.state, "", url);
    }
  }

  function toggleCard(id: string, visible: boolean): void {
    if (!isTableCardId(id)) return;
    if (isEdit) {
      if (!visible && cards.length === 1 && cards[0] === id) {
        model.notice = { kind: "warn", text: m["editor.cards.keep_one"]() };
        return;
      }
      applyCards(setCardShow(cards, id, visible));
      return;
    }
    applyCards(setSectionOpen(cards, id, visible), { persist: false });
  }

  /** details 的 toggle 事件在浏览器切换 open 后触发，这里把状态收回页面。 */
  function handleSectionToggle(id: TableCardId, event: Event): void {
    if (!(event.currentTarget instanceof HTMLDetailsElement)) return;
    toggleCard(id, event.currentTarget.open);
  }

  /** 深链锚点对应的卡；查看态展开，编辑态显示。 */
  function sectionFromHash(hash: string): TableCardId | null {
    if (hash === "#overview") return "header";
    if (hash === "#charts-list") return "charts";
    if (hash === "#course-list") return "course";
    return null;
  }

  let handledHash = "";

  $effect(() => {
    if (model.headerLoadState !== "loaded" || hashTarget === "") return;
    if (hashTarget === handledHash) return;
    const id = sectionFromHash(hashTarget);
    if (id === null) return;
    handledHash = hashTarget;
    if (!cards.includes(id)) {
      toggleCard(id, true);
      void tick().then(() => {
        document
          .getElementById(CARD_ANCHORS[id])
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    document
      .getElementById(CARD_ANCHORS[id])
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const tocItems = $derived<TocItem[]>(
    model.headerLoadState === "loaded"
      ? isEdit
        ? [
            ...(cards.includes("header")
              ? [
                  { id: "overview", title: m["editor.frame.header"](), href: "#overview" },
                  ...(levelRefHasData
                    ? [{ id: "level-ref", title: m["levelref.heading"](), href: "#level-ref" }]
                    : []),
                ]
              : []),
            ...(cards.includes("charts")
              ? [
                  {
                    id: "charts-list",
                    title: m["editor.entries.section"](),
                    href: "#charts-list",
                  },
                ]
              : []),
            ...(cards.includes("course")
              ? [{ id: "course-list", title: m["editor.course.section"](), href: "#course-list" }]
              : []),
          ]
        : [
            { id: "overview", title: m["editor.frame.header"](), href: "#overview" },
            ...(cards.includes("header") && levelRefHasData
              ? [{ id: "level-ref", title: m["levelref.heading"](), href: "#level-ref" }]
              : []),
            {
              id: "charts-list",
              title: m["editor.entries.section"](),
              href: "#charts-list",
            },
            { id: "course-list", title: m["editor.course.section"](), href: "#course-list" },
          ]
      : []
  );
</script>

<svelte:head>
  <title>{formatTitle(model.pageTitle)}</title>
</svelte:head>

<!-- mainClass 覆盖默认 pb-8：底部为操作 dock 的右下角面板留出空间 -->
<PageShell
  mainClass="m-0 mx-auto box-border w-full max-w-350 px-8 pt-24 pb-40 {isEdit
    ? 'editor-cardbar-sticky'
    : ''}"
  {tocItems}
  hero={heroPane}
  sectionSwitcher={switcherPane}
  panes={model.headerLoadState === "loading"
    ? [headerLoadingPane]
    : model.headerLoadState === "error"
      ? [headerErrorPane]
      : isEdit
        ? [
            ...(cards.includes("header") ? [overviewPane] : []),
            ...(cards.includes("charts") ? [chartsPane] : []),
            ...(cards.includes("course") ? [coursePane] : []),
          ]
        : [viewHeaderPane, viewChartsPane, viewCoursePane]}
/>

<!-- 底部操作 dock：header 就绪即可打开；data 未就绪时编辑与保存禁用 -->
{#if model.headerReady}
  <TableDock
    {model}
    mode={isEdit ? "edit" : "view"}
    {createMode}
    showSaveAsShared={saveAsShared !== "none" && !copyMode}
    {editHint}
    {tableActions}
    {adminActions}
    importSection={isEdit ? importSection : undefined}
    onSetMode={handleDockSetMode}
    showPrimary={showDockPrimary}
    {primaryLabel}
    primaryDisabled={!dataReady}
    primaryTitle={!dataReady ? m["editor.partial.edit_disabled"]() : undefined}
    onPrimary={handlePrimary}
    {copyMode}
  />
{/if}

<ConfirmDialog dialog={confirmDialog} />

<!-- 编辑态全页拖拽接收：与导入折叠段的拖拽区共用同一管线 -->
{#if isEdit && dataReady}
  <BmsDropOverlay
    entries={model.entries}
    disabled={model.busy || addDrawerOpen}
    onadd={handlePageDrop}
  />
{/if}

<!-- 表操作折叠段：导出、查看原文与 fork（fork 仅查看态；编辑态另存共享在按钮区） -->
{#snippet tableActions()}
  <button
    class="{btnGhost} w-full"
    type="button"
    disabled={!headerReady}
    onclick={() => model.exportTable("header")}
  >
    <Download class="size-4 shrink-0" aria-hidden="true" />
    {m["editor.export.header"]()}
  </button>
  <button
    class="{btnGhost} w-full"
    type="button"
    disabled={!dataReady}
    onclick={() => model.exportTable("data")}
  >
    <Download class="size-4 shrink-0" aria-hidden="true" />
    {m["editor.export.data"]()}
  </button>
  <button
    class="{btnGhost} w-full"
    type="button"
    disabled={!dataReady}
    onclick={() => model.exportTable("package")}
  >
    <Download class="size-4 shrink-0" aria-hidden="true" />
    {m["editor.export.package"]()}
  </button>
  <a
    class="{btnGhost} w-full"
    href="https://github.com/brightmeows/bms-skills/blob/main/skills/bms-table/SKILL.md"
    target="_blank"
    rel="noopener noreferrer"
  >
    <BookOpen class="size-4 shrink-0" aria-hidden="true" />
    {m["table.page.reference"]()}
  </a>
  {#if !isEdit && dataReady && saveAsShared === "same-origin"}
    {#if primaryKind === "copy"}
      <button class="{btnGhost} w-full" type="button" disabled={model.busy} onclick={handlePrimary}>
        <Copy class="size-4 shrink-0" aria-hidden="true" />
        {primaryLabel}
      </button>
    {:else if !copyMode}
      <button
        class="{btnGhost} w-full"
        type="button"
        disabled={model.busy}
        onclick={() => void model.saveAsSharedNow()}
      >
        <Copy class="size-4 shrink-0" aria-hidden="true" />
        {sharedMode ? m["shared.detail.fork"]() : m["editor.save.as_shared"]()}
      </button>
    {/if}
  {/if}
{/snippet}

{#snippet heroActions()}
  {#if importUrl !== null}
    <button class={btnGhostMd} type="button" title={importUrl} onclick={copyImportUrl}>
      {#if cb.copied}
        <Check class="size-4 shrink-0 text-success" aria-hidden="true" />
      {:else if cb.failed}
        <TriangleAlert class="size-4 shrink-0 text-error" aria-hidden="true" />
      {:else}
        <Copy class="size-4 shrink-0" aria-hidden="true" />
      {/if}
      {cb.copied
        ? m["common.copied"]()
        : cb.failed
          ? m["common.copy_failed"]()
          : m["table.view.copy_import"]()}
    </button>
  {/if}
  {#if headerUrl !== null}
    <a class={btnGhostMd} href={headerUrl} target="_blank" rel="noopener noreferrer">
      {m["table.view.header"]()}
      <ExternalLink class="size-4 shrink-0" aria-hidden="true" />
    </a>
  {/if}
  {#if dataReady && model.dataFetchUrl !== null}
    <a class={btnGhostMd} href={model.dataFetchUrl} target="_blank" rel="noopener noreferrer">
      {m["table.view.data"]()}
      <ExternalLink class="size-4 shrink-0" aria-hidden="true" />
    </a>
  {/if}
{/snippet}

{#snippet heroPane()}
  <PageHero
    clamp={false}
    titleText={model.pageTitle}
    meta={model.symbol.trim() !== "" ? m["table.page.symbol"]({ symbol: model.symbol }) : undefined}
    actions={headerReady && !createMode ? heroActions : undefined}
  >
    {#snippet title()}
      {#if isEdit}
        <input
          class="w-full rounded-glass-sm bg-transparent text-center outline-none [font:inherit] placeholder:text-white-30 focus-visible:ring-2 focus-visible:ring-accent/40"
          type="text"
          bind:value={model.name}
          placeholder={model.pageTitle}
          disabled={model.busy || !dataReady}
          aria-label={m["editor.fields.name"]()}
          oninput={() => model.markDirty()}
        />
      {:else}
        {model.pageTitle}
      {/if}
    {/snippet}
  </PageHero>
{/snippet}

{#snippet switcherPane()}
  <div
    class="mx-auto mb-4 flex w-full max-w-[1000px] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[0.9rem] text-white-60"
  >
    {#if model.ready && model.tableStats}
      <span>
        {m["table.stats.summary"]({
          total: model.tableStats.totalCharts,
          difficulties: model.tableStats.difficulties.length,
        })}
      </span>
    {:else if headerReady}
      <span>{m["table.stats.data_pending"]()}</span>
    {/if}
  </div>
  {#if headerReady && actions}
    <div
      class="mx-auto mb-4 flex w-full max-w-[1000px] flex-wrap items-center justify-center gap-2"
    >
      {@render actions()}
    </div>
  {/if}
  {#if isEdit && sharedMode && capabilities.canWrite !== true}
    <p
      class="mx-auto mb-4 w-full max-w-[1000px] rounded-glass-sm border border-white-15 bg-black-20 px-3 py-2 text-[0.85rem] text-white-65"
    >
      {m["editor.frame.shared_local_hint"]()}
    </p>
  {/if}
  {#if isEdit}
    <div class="sticky top-[3.75rem] z-30 mx-auto mb-4 w-full max-w-350">
      <GlassPanel
        padding="sm"
        class="w-full"
        style={{ "background-color": "var(--color-background)" }}
      >
        <TableCardBar
          items={cardBarItems}
          ariaLabel={m["table.page.sections"]()}
          onToggle={toggleCard}
        />
      </GlassPanel>
    </div>
  {/if}
  {#if copyMode || (isEdit && !dataReady)}
    <div class="mx-auto mb-4 flex w-full max-w-[1000px] flex-col items-center gap-2">
      {#if copyMode}
        <p
          class="rounded-glass-sm border border-accent/40 bg-accent/10 px-3 py-2 text-[0.85rem] text-accent-light"
        >
          {m["editor.permission.copy_banner"]()}
        </p>
      {/if}
      {#if isEdit && !dataReady}
        <p
          class="rounded-glass-sm border border-white-15 bg-black-20 px-3 py-2 text-[0.85rem] text-white-65"
        >
          {m["editor.partial.edit_disabled"]()}
        </p>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet headerLoadingPane()}
  <div class="p-8">
    <LoadingProgress
      title={m["table.loading.data_title"]()}
      message={m["table.loading.header_request"]()}
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

{#snippet overviewContent()}
  <TableOverviewPanel
    editing={isEdit}
    bind:name={model.name}
    bind:symbol={model.symbol}
    bind:tag={model.tag}
    bind:headerMode={model.headerMode}
    bind:levels={model.levels}
    extraHeader={model.extraHeader}
    disabled={isEdit ? model.busy || !dataReady : false}
    headerUrl={headerUrl ?? undefined}
    bind:levelRefHasData
    bind:levelRefLoadState
    management={copyMode ? undefined : management}
    onChange={model.markDirty}
    onNotice={(value: EditorNotice) => (model.notice = value)}
  />
{/snippet}

{#snippet overviewPane()}
  <div id="overview" class="scroll-mt-20">
    {@render overviewContent()}
  </div>
{/snippet}

{#snippet courseContent()}
  <CoursePanel
    editing={isEdit}
    groups={model.courseGroups}
    bind:model={model.courseModel}
    entries={model.entries}
    symbol={model.symbol}
    dataReady={model.dataReady}
    nested={model.courseModel.shape === "nested"}
    disabled={isEdit ? model.busy || !dataReady : false}
    onChange={model.markDirty}
    onBeforeChange={model.captureForUndo}
    onNotice={(value: EditorNotice) => (model.notice = value)}
  />
{/snippet}

{#snippet coursePane()}
  <div id="course-list" class="scroll-mt-20">
    {@render courseContent()}
  </div>
{/snippet}

{#snippet chartsContent()}
  <EntriesPanel
    editing={isEdit}
    bind:entries={model.entries}
    levels={model.levels}
    symbol={model.symbol}
    bind:levelHints={model.levelHints}
    bind:courseModel={model.courseModel}
    dataReady={model.dataReady}
    disabled={isEdit ? model.busy || !dataReady : false}
    loadState={model.dataLoadState}
    loadMessage={model.loadMessage}
    loadPercent={model.loadPercent}
    loadDetail={model.loadDetail}
    dataError={model.dataError}
    onRetry={model.retryData}
    onChange={model.markDirty}
    onNotice={(value: EditorNotice) => (model.notice = value)}
    onAddDrawerOpenChange={(open: boolean) => (addDrawerOpen = open)}
    bind:hiddenLevels
    bind:hideUnassigned
  />
{/snippet}

{#snippet chartsPane()}
  <div id="charts-list" class="scroll-mt-20">
    {@render chartsContent()}
  </div>
{/snippet}

{#snippet viewHeaderPane()}
  <details
    id="overview"
    class="scroll-mt-20"
    open={cards.includes("header")}
    ontoggle={(event) => handleSectionToggle("header", event)}
  >
    <summary
      class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-glass-sm py-2 text-[1.05rem] font-semibold text-white [&::-webkit-details-marker]:hidden"
    >
      <ChevronDown
        class="size-4 shrink-0 text-white-50 transition-transform {cards.includes('header')
          ? 'rotate-180'
          : ''}"
        aria-hidden="true"
      />
      {m["editor.frame.header"]()}
    </summary>
    <div class="pt-4">
      {@render overviewContent()}
    </div>
  </details>
{/snippet}

{#snippet viewChartsPane()}
  <details
    id="charts-list"
    class="scroll-mt-20"
    open={cards.includes("charts")}
    ontoggle={(event) => handleSectionToggle("charts", event)}
  >
    <summary
      class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-glass-sm py-2 text-[1.05rem] font-semibold text-white [&::-webkit-details-marker]:hidden"
    >
      <ChevronDown
        class="size-4 shrink-0 text-white-50 transition-transform {cards.includes('charts')
          ? 'rotate-180'
          : ''}"
        aria-hidden="true"
      />
      {m["editor.entries.section"]()}
      {#if sectionCount("charts") !== undefined}
        <span class={badgeCountSm}>{sectionCount("charts")}</span>
      {/if}
    </summary>
    <div class="pt-4">
      {@render chartsContent()}
    </div>
  </details>
{/snippet}

{#snippet viewCoursePane()}
  <details
    id="course-list"
    class="scroll-mt-20"
    open={cards.includes("course")}
    ontoggle={(event) => handleSectionToggle("course", event)}
  >
    <summary
      class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-glass-sm py-2 text-[1.05rem] font-semibold text-white [&::-webkit-details-marker]:hidden"
    >
      <ChevronDown
        class="size-4 shrink-0 text-white-50 transition-transform {cards.includes('course')
          ? 'rotate-180'
          : ''}"
        aria-hidden="true"
      />
      {m["editor.course.section"]()}
      {#if sectionCount("course") !== undefined}
        <span class={badgeCountSm}>{sectionCount("course")}</span>
      {/if}
    </summary>
    <div class="pt-4">
      {@render courseContent()}
    </div>
  </details>
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
      disabled={model.busy || !dataReady}
      onChange={model.markDirty}
      onNotice={(value: EditorNotice | null) => (model.notice = value)}
      confirm={(message) => confirmDialog.ask(message, { destructive: true })}
    />
  {/if}
{/snippet}
