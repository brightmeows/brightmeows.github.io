<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";
  import Eye from "@lucide/svelte/icons/eye";
  import History from "@lucide/svelte/icons/history";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Redo2 from "@lucide/svelte/icons/redo-2";
  import Save from "@lucide/svelte/icons/save";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";

  import ToggleButton from "#lib/components/ui/ToggleButton.svelte";
  import { btnGhostMd, btnPrimary } from "#lib/constants/ui-classes.js";
  import {
    applyDockScroll,
    createDockScrollState,
    toggleDockExpansion,
    type DockExpansion,
    type DockMode,
  } from "#lib/controllers/table-dock.js";
  import type { TableModel } from "#lib/data/table-page-model.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  /**
   * 右下角 dock：查看态收起是主按钮加“菜单”按钮，编辑态收起是只读“编辑中”胶囊、
   * dirty 时的保存按钮与“菜单”按钮；展开面板收导入全三 tab、导出下载、格式参考、
   * fork、草稿与 notice 等段。保存常驻菜单外，状态胶囊只读，菜单按钮负责展开。
   * 收展由 controllers/table-dock 状态机驱动（编辑态默认展开、查看态默认收起，
   * 模式切换重置初值并滚回页首；滚动累积阈值下滑收起、上滑展开、停止不展开；
   * 键盘焦点在 dock 内冻结，busy 与待恢复草稿豁免滚动收起；距页底不强制展开——
   * 保存常驻后强制展开会遮住行内操作）。编辑态仅额外动态加载导入器渲染进导入段。
   */
  import { panelFly } from "#lib/utils/ui/transitions.js";

  /**
   * 难度表页底部操作 dock：
   * - 常驻右下角：查看态收起是主按钮（按权限显示编辑、本地编辑或创建
   *   副本）加“菜单”按钮（SlidersHorizontal 图标加文字；信号色点挂在
   *   按钮上）；编辑态收起是只读“编辑中”胶囊（色点加短词：黄=未保存、
   *   橙=警告、红=错误、绿=完成、浅蓝=待恢复草稿，悬停 title 保留完整
   *   notice 文本）、dirty 时的保存按钮与“菜单”按钮。展开态是 340px
   *   玻璃面板（窄屏回退全宽），面板头为模式状态标识，下方纵排承载
   *   预览、保存、另存、放弃、notice、草稿横幅与自动保存时刻；查看态
   *   主按钮下内联进入编辑说明；表整体操作与导入区以折叠段收进面板
   *   （表操作查看态默认展开、编辑态默认收起；导入段默认收起，空表
   *   自动展开一次，手动收起后本会话不再自动），导入段展开时面板加宽
   *   到 480px；管理员对他人共享表的删除槽在菜单底部；
   * - 保存常驻收起态与面板内，不埋进菜单；状态胶囊只读，菜单按钮负责
   *   展开；
   * - 收展由 controllers/table-dock 的状态机驱动：模式初值（编辑展开、
   *   查看收起）、滚动方向（下滑收起、上滑展开，累积阈值同顶栏）、
   *   键盘焦点冻结；busy 与待恢复草稿豁免滚动收起；保存常驻后不再在
   *   页底强制展开，避免面板遮住行内操作；
   * - 状态与操作自标题区迁入（2026-11），标题区只留身份信息与分区导航。
   *   2026-11 收起态拆分：查看态主操作一步直达编辑，不再经由“查看中”
   *   胶囊两跳，“查看中”只在展开面板头保留。
   */
  interface Props {
    /** 页面共享的内存模型门面（busy、dirty、notice、草稿与保存操作）。 */
    model: TableModel;
    /** 当前模式；变化时 dock 重置为该模式的默认收展态。 */
    mode: DockMode;
    /** 创建态（共享表首次保存前）：无“查看模式”按钮。 */
    createMode: boolean;
    /** 是否显示“另存为我的共享表”。 */
    showSaveAsShared: boolean;
    /** “编辑此表”按钮下方的内联说明文案。 */
    editHint: string;
    /** 表操作折叠段内容（导出、查看原文、fork）；缺省隐藏该段。 */
    tableActions?: Snippet | undefined;
    /** 导入折叠段内容（编辑态动态加载后传入）；缺省隐藏该段。 */
    importSection?: Snippet | undefined;
    /** 菜单里的管理员操作槽（他人共享表的删除）；缺省隐藏。 */
    adminActions?: Snippet | undefined;
    /** 模式切换回调：页面实现切换后的滚回页首。 */
    onSetMode: (next: DockMode) => void;
    /** 查看态主按钮文案、禁用态与回调（编辑、本地编辑或创建副本）。 */
    primaryLabel: string;
    primaryDisabled: boolean;
    primaryTitle?: string | undefined;
    onPrimary: () => void;
    /** 副本意图：主按钮使用 Copy 图标，面板头仍显示编辑态。 */
    copyMode: boolean;
  }

  let {
    model,
    mode,
    createMode,
    showSaveAsShared,
    editHint,
    tableActions = undefined,
    importSection = undefined,
    adminActions = undefined,
    onSetMode,
    primaryLabel,
    primaryDisabled,
    primaryTitle = undefined,
    onPrimary,
    copyMode,
  }: Props = $props();

  /** 成功类 notice 的自动清除时延；warn 与 error 常驻到被下一次替换。 */
  const NOTICE_OK_TTL_MS = 8000;

  let editing = $derived(mode === "edit");

  /** 面板头与编辑态收起胶囊共用的模式状态词。 */
  let stateWord = $derived(
    editing ? m["editor.dock.state_editing"]() : m["editor.dock.state_viewing"]()
  );

  // ---- 收展状态：滚动累积无需触发渲染，放普通变量；expansion 单独响应式 ----
  // svelte-ignore state_referenced_locally —— 初值取挂载时的模式；模式变化由下方 effect 重置
  let scrollState = createDockScrollState(mode);
  let expansion = $state<DockExpansion>(scrollState.expansion);
  let keyboardFocus = $state(false);
  let lastScrollY = 0;

  // ---- 折叠段：表操作与导入 ----
  let tableActionsOpen = $state(false);
  let importOpen = $state(false);
  /** 用户手动收起导入段后，本会话不再自动展开。 */
  let importDismissed = $state(false);

  // 模式变化重置初值（挂载时同样执行一次，与初始化等价）
  $effect(() => {
    scrollState = createDockScrollState(mode);
    expansion = scrollState.expansion;
    tableActionsOpen = mode === "view";
    importOpen = false;
    importDismissed = false;
  });

  // 空表（新建/未导入）自动展开导入段一次，引导第一步操作
  $effect(() => {
    if (mode !== "edit" || importDismissed) return;
    if (model.dataLoadState === "loaded" && model.entries.length === 0) importOpen = true;
  });

  function toggleTableActions(): void {
    tableActionsOpen = !tableActionsOpen;
  }

  function toggleImport(): void {
    importOpen = !importOpen;
    if (!importOpen) importDismissed = true;
  }

  // 成功类 notice 短暂展示后自动清除；期间被替换（引用不同）则不清除
  $effect(() => {
    const notice = model.notice;
    if (notice === null || notice.kind !== "ok") return;
    const timer = window.setTimeout(() => {
      if (model.notice === notice) model.notice = null;
    }, NOTICE_OK_TTL_MS);
    return () => window.clearTimeout(timer);
  });

  function scrollGuards() {
    return {
      busy: model.busy,
      draftPending: model.pendingDraft !== null,
      // 保存常驻收起态与“菜单”文字后，不再需要在页底强制展开面板；
      // 强制展开会遮住正文右侧的行内操作，改为用户主动打开。
      nearBottom: false,
      keyboardFocus,
    };
  }

  function handleScroll(): void {
    const current = window.scrollY;
    const delta = current - lastScrollY;
    lastScrollY = current;
    scrollState = applyDockScroll(scrollState, delta, scrollGuards());
    expansion = scrollState.expansion;
  }

  function toggleExpansion(): void {
    scrollState = toggleDockExpansion(scrollState);
    expansion = scrollState.expansion;
  }

  function handleFocusIn(event: FocusEvent): void {
    keyboardFocus = event.target instanceof HTMLElement && event.target.matches(":focus-visible");
  }

  function handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    const root = event.currentTarget;
    keyboardFocus =
      next instanceof HTMLElement &&
      next.matches(":focus-visible") &&
      root instanceof HTMLElement &&
      root.contains(next);
  }

  onMount(() => {
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  });

  // 状态信号（收起胶囊与面板头共用）：色点加短词成对，点仅作词的项目符号，
  // 多状态并存时全部显示；黄=未保存、橙=警告、红=错误、绿=完成、浅蓝=草稿
  let dockSignals = $derived.by(() => {
    const signals: { word: string; dot: string; text: string; title: string }[] = [];
    if (model.dirty) {
      signals.push({
        word: m["editor.dock.state_unsaved"](),
        dot: "bg-amber-300",
        text: "text-amber-300",
        title: m["editor.dock.unsaved_badge"](),
      });
    }
    if (model.notice !== null) {
      if (model.notice.kind === "error") {
        signals.push({
          word: m["editor.dock.notice_error"](),
          dot: "bg-error",
          text: "text-error",
          title: model.notice.text,
        });
      } else if (model.notice.kind === "warn") {
        signals.push({
          word: m["editor.dock.notice_warn"](),
          dot: "bg-warning",
          text: "text-warning-light",
          title: model.notice.text,
        });
      } else {
        signals.push({
          word: m["editor.dock.notice_ok"](),
          dot: "bg-success",
          text: "text-success",
          title: model.notice.text,
        });
      }
    }
    if (model.pendingDraft !== null) {
      signals.push({
        word: m["editor.dock.draft_pending"](),
        dot: "bg-accent-light",
        text: "text-accent-light",
        title: m["editor.draft.found_title"](),
      });
    }
    return signals;
  });
</script>

{#if expansion === "expanded"}
  <div
    class="pointer-events-none fixed right-0 bottom-0 z-999 flex justify-end px-4 pb-4 max-sm:left-0 max-sm:justify-center max-sm:px-0"
    style="padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem)"
    in:fly={panelFly().in}
    out:fly={panelFly().out}
  >
    <div
      class="glass-shadow-float pointer-events-auto max-h-full w-[340px] max-w-full overflow-y-auto rounded-glass-lg bg-glass p-3 backdrop-blur transition-[width] duration-200 max-sm:w-full {importOpen
        ? 'sm:w-[480px]'
        : 'sm:w-[340px]'}"
      style="max-height: calc(100dvh - 2rem - env(safe-area-inset-bottom, 0px))"
      onfocusin={handleFocusIn}
      onfocusout={handleFocusOut}
    >
      <div class="flex items-center justify-between gap-2 border-b border-white-15 pb-2">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {#if editing}
            <Pencil class="size-4 shrink-0 text-white-80" aria-hidden="true" />
          {:else}
            <Eye class="size-4 shrink-0 text-white-80" aria-hidden="true" />
          {/if}
          <span class="text-[0.85rem] text-white-85">{stateWord}</span>
          {#each dockSignals as signal (signal.title)}
            <span class="flex items-center gap-1 text-[0.8rem] {signal.text}" title={signal.title}>
              <span class="size-2 shrink-0 rounded-full {signal.dot}"></span>
              {signal.word}
            </span>
          {/each}
        </div>
        <button
          class="p-1 text-white-60 transition-colors duration-150 hover:text-white"
          type="button"
          aria-label={m["editor.dock.collapse"]()}
          title={m["editor.dock.collapse"]()}
          onclick={toggleExpansion}
        >
          <ChevronDown class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-3 flex flex-col items-stretch gap-2">
        {#if editing}
          {#if !createMode}
            <button class="{btnGhostMd} w-full" type="button" onclick={() => onSetMode("view")}>
              <Eye class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.dock.preview"]()}
            </button>
          {/if}
          {#if model.canSave}
            <button
              class="{btnPrimary} w-full"
              type="button"
              disabled={model.busy}
              onclick={() => void model.save()}
            >
              <Save class="size-4 shrink-0" aria-hidden="true" />
              {model.saveLabel}
            </button>
          {/if}
          {#if showSaveAsShared}
            <button
              class="{btnGhostMd} w-full"
              type="button"
              disabled={model.busy || !model.dataReady}
              onclick={() => void model.saveAsSharedNow()}
            >
              <Copy class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.save.as_shared"]()}
            </button>
          {/if}
        {:else}
          <button
            class="{btnPrimary} w-full"
            type="button"
            disabled={primaryDisabled}
            title={primaryTitle}
            onclick={onPrimary}
          >
            {#if copyMode}
              <Copy class="size-4 shrink-0" aria-hidden="true" />
            {:else}
              <Pencil class="size-4 shrink-0" aria-hidden="true" />
            {/if}
            {primaryLabel}
          </button>
          <p class="text-center text-[0.8rem] text-white-50">{editHint}</p>
        {/if}

        {#if model.dirty}
          {#if !editing && model.canSave}
            <button
              class="{btnPrimary} w-full"
              type="button"
              disabled={model.busy}
              onclick={() => void model.save()}
            >
              <Save class="size-4 shrink-0" aria-hidden="true" />
              {model.saveLabel}
            </button>
          {/if}
          <button
            class="{btnGhostMd} w-full"
            type="button"
            disabled={model.busy}
            onclick={() => void model.discardEdits()}
          >
            <Undo2 class="size-4 shrink-0" aria-hidden="true" />
            {m["editor.discard.unsaved"]()}
          </button>
          <div class="flex gap-2">
            <button
              class="{btnGhostMd} flex-1"
              type="button"
              disabled={!model.canUndo}
              onclick={() => model.undo()}
            >
              <Undo2 class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.undo.undo"]()}
            </button>
            <button
              class="{btnGhostMd} flex-1"
              type="button"
              disabled={!model.canRedo}
              onclick={() => model.redo()}
            >
              <Redo2 class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.undo.redo"]()}
            </button>
          </div>
        {/if}
      </div>

      {#if tableActions}
        <div class="mt-3 border-t border-white-15 pt-2">
          <ToggleButton
            expanded={tableActionsOpen}
            label={m["editor.dock.table_actions"]()}
            onToggle={toggleTableActions}
          />
          {#if tableActionsOpen}
            <div class="mt-2 flex flex-col items-stretch gap-2">
              {@render tableActions()}
            </div>
          {/if}
        </div>
      {/if}

      {#if importSection}
        <div class="mt-3 border-t border-white-15 pt-2">
          <ToggleButton
            expanded={importOpen}
            label={m["editor.import.section"]()}
            onToggle={toggleImport}
          />
          {#if importOpen}
            <div class="mt-2">
              {@render importSection()}
            </div>
          {/if}
        </div>
      {/if}

      {#if adminActions}
        <div class="mt-3 border-t border-white-15 pt-2">
          <div class="px-1 pb-2 text-[0.85rem] text-white-50">
            {m["editor.permission.admin_manage"]()}
          </div>
          <div class="flex flex-col items-stretch gap-2">
            {@render adminActions()}
          </div>
        </div>
      {/if}

      {#if editing && model.draftStatusText !== ""}
        <p class="mt-2 text-center text-[0.85rem] text-white-50">{model.draftStatusText}</p>
      {/if}

      {#if model.pendingDraft !== null}
        <div class="mt-3 border-t border-white-15 pt-3 text-center">
          <p class="text-[1.05rem] text-amber-200">{m["editor.draft.found_title"]()}</p>
          <p class="mx-auto mt-2 max-w-120 text-[0.9rem] text-white-65">
            {m["editor.draft.found_desc"]({ time: model.formatClock(model.pendingDraft.savedAt) })}
          </p>
          <div class="mt-3 flex flex-wrap justify-center gap-3">
            <button class={btnPrimary} type="button" onclick={model.restorePendingDraft}>
              <History class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.draft.restore"]()}
            </button>
            <button
              class={btnGhostMd}
              type="button"
              onclick={() => void model.discardPendingDraft()}
            >
              <Trash2 class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.draft.discard"]()}
            </button>
          </div>
        </div>
      {/if}

      {#if model.notice !== null}
        <div
          class="mt-3 rounded-glass-sm border px-3 py-2 text-center text-[0.85rem] {model.notice
            .kind === 'ok'
            ? 'border-success/40 bg-success/10 text-success'
            : model.notice.kind === 'warn'
              ? 'border-warning/40 bg-warning/10 text-warning-light'
              : 'border-error/40 bg-error/10 text-error'}"
        >
          {model.notice.text}
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div
    class="fixed right-4 z-999 flex items-center gap-2"
    style="bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem)"
    onfocusin={handleFocusIn}
    onfocusout={handleFocusOut}
    in:fly={panelFly().in}
    out:fly={panelFly().out}
  >
    {#if editing}
      <div
        class="glass-shadow-float flex items-center gap-2 rounded-full bg-glass px-3.5 py-2 backdrop-blur"
        role="status"
      >
        <Pencil class="size-4 text-white-80" aria-hidden="true" />
        <span class="text-[0.85rem] whitespace-nowrap text-white-85">{stateWord}</span>
        {#each dockSignals as signal (signal.title)}
          <span
            class="flex items-center gap-1 text-[0.8rem] whitespace-nowrap {signal.text}"
            title={signal.title}
          >
            <span class="size-2 shrink-0 rounded-full {signal.dot}"></span>
            {signal.word}
          </span>
        {/each}
      </div>
      {#if model.dirty && model.canSave}
        <button
          class={btnPrimary}
          type="button"
          disabled={model.busy}
          onclick={() => void model.save()}
        >
          <Save class="size-4 shrink-0" aria-hidden="true" />
          {model.saveLabel}
        </button>
      {/if}
    {:else}
      <button
        class={btnPrimary}
        type="button"
        disabled={primaryDisabled}
        title={primaryTitle}
        onclick={onPrimary}
      >
        {#if copyMode}
          <Copy class="size-4 shrink-0" aria-hidden="true" />
        {:else}
          <Pencil class="size-4 shrink-0" aria-hidden="true" />
        {/if}
        {primaryLabel}
      </button>
      {#if model.dirty && model.canSave}
        <button
          class={btnGhostMd}
          type="button"
          disabled={model.busy}
          onclick={() => void model.save()}
        >
          <Save class="size-4 shrink-0" aria-hidden="true" />
          {model.saveLabel}
        </button>
      {/if}
    {/if}
    <button
      class="glass-shadow-float flex items-center gap-2 rounded-full bg-glass px-3 py-2.5 backdrop-blur"
      type="button"
      aria-label={m["editor.dock.menu"]()}
      title={m["editor.dock.menu"]()}
      onclick={toggleExpansion}
    >
      <SlidersHorizontal class="size-4 text-white-80" aria-hidden="true" />
      <span class="text-[0.85rem] whitespace-nowrap text-white-85">
        {m["editor.dock.menu"]()}
      </span>
      {#each dockSignals as signal (signal.title)}
        <span class="size-2 shrink-0 rounded-full {signal.dot}" title={signal.title}></span>
      {/each}
    </button>
  </div>
{/if}
