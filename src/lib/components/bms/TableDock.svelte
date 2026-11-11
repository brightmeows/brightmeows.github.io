<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";
  import Eye from "@lucide/svelte/icons/eye";
  import History from "@lucide/svelte/icons/history";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Save from "@lucide/svelte/icons/save";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  import ToggleButton from "#lib/components/ui/ToggleButton.svelte";
  import { btnBar, btnGhostMd, btnPrimary } from "#lib/constants/ui-classes.js";
  import {
    applyDockScroll,
    createDockScrollState,
    toggleDockExpansion,
    type DockExpansion,
    type DockMode,
  } from "#lib/controllers/table-dock.js";
  import type { TableModel } from "#lib/data/table-page-model.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { isNearDocumentBottom } from "#lib/utils/ui/topbar-scroll.js";

  /**
   * 难度表页底部操作 dock：
   * - 常驻右下角：收起态是模式胶囊（图标加状态词；状态以“色点+短词”
   *   成对提示：黄=未保存、橙=警告、红=错误、绿=完成、浅蓝=待恢复草稿，
   *   悬停 title 保留完整 notice 文本），展开态是 340px 玻璃面板
   *   （窄屏回退全宽），面板头为同一状态标识，下方纵排承载模式切换、
   *   保存、另存、放弃、notice、草稿横幅与自动保存时刻；查看态编辑
   *   按钮下内联进入编辑说明；表整体操作（导出、查看原文、fork）与导入区以折叠段
   *   收进面板（表操作查看态默认展开、编辑态默认收起；导入段默认收起，
   *   空表自动展开一次，手动收起后本会话不再自动），导入段展开时面板
   *   加宽到 480px；
   * - 收展由 controllers/table-dock 的状态机驱动：模式初值（编辑展开、
   *   查看收起）、滚动方向（下滑收起、上滑展开，累积阈值同顶栏）、
   *   距页底强制展开、键盘焦点冻结；busy 与待恢复草稿豁免滚动收起；
   * - 状态与操作自标题区迁入（2026-11），标题区只留身份信息与分区导航。
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
    /** 模式切换回调：页面实现切换后的滚回页首。 */
    onSetMode: (next: DockMode) => void;
  }

  let {
    model,
    mode,
    createMode,
    showSaveAsShared,
    editHint,
    tableActions = undefined,
    importSection = undefined,
    onSetMode,
  }: Props = $props();

  /** 成功类 notice 的自动清除时延；warn 与 error 常驻到被下一次替换。 */
  const NOTICE_OK_TTL_MS = 8000;

  let editing = $derived(mode === "edit");

  /** 面板头与收起胶囊共用的模式状态词。 */
  let stateWord = $derived(
    editing ? m["editor.dock_state_editing"]() : m["editor.dock_state_viewing"]()
  );

  // ---- 收展状态：滚动累积无需触发渲染，放普通变量；expansion 单独响应式 ----
  // svelte-ignore state_referenced_locally —— 初值取挂载时的模式；模式变化由下方 effect 重置
  let scrollState = createDockScrollState(mode);
  let expansion = $state<DockExpansion>(scrollState.expansion);
  let keyboardFocus = $state(false);
  let lastScrollY = 0;
  let reduceMotion = $state(false);

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
      nearBottom: isNearDocumentBottom(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight
      ),
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
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = motionQuery.matches;
    const onMotionChange = (event: MediaQueryListEvent): void => {
      reduceMotion = event.matches;
    };
    motionQuery.addEventListener("change", onMotionChange);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  });

  // 状态信号（收起胶囊与面板头共用）：色点加短词成对，点仅作词的项目符号，
  // 多状态并存时全部显示；黄=未保存、橙=警告、红=错误、绿=完成、浅蓝=草稿
  let dockSignals = $derived.by(() => {
    const signals: { word: string; dot: string; text: string; title: string }[] = [];
    if (model.dirty) {
      signals.push({
        word: m["editor.dock_state_unsaved"](),
        dot: "bg-amber-300",
        text: "text-amber-300",
        title: m["editor.unsaved_badge"](),
      });
    }
    if (model.notice !== null) {
      if (model.notice.kind === "error") {
        signals.push({
          word: m["editor.dock_notice_error"](),
          dot: "bg-error",
          text: "text-error",
          title: model.notice.text,
        });
      } else if (model.notice.kind === "warn") {
        signals.push({
          word: m["editor.dock_notice_warn"](),
          dot: "bg-warning",
          text: "text-warning-light",
          title: model.notice.text,
        });
      } else {
        signals.push({
          word: m["editor.dock_notice_ok"](),
          dot: "bg-success",
          text: "text-success",
          title: model.notice.text,
        });
      }
    }
    if (model.pendingDraft !== null) {
      signals.push({
        word: m["editor.dock_draft_pending"](),
        dot: "bg-accent-light",
        text: "text-accent-light",
        title: m["editor.draft_found_title"](),
      });
    }
    return signals;
  });
</script>

{#if expansion === "expanded"}
  <div
    class="pointer-events-none fixed right-0 bottom-0 z-999 flex justify-end px-4 pb-4 max-sm:left-0 max-sm:justify-center max-sm:px-0"
    style="padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem)"
    in:fly={{ y: 24, opacity: 0, duration: reduceMotion ? 0 : 180, easing: cubicOut }}
    out:fly={{ y: 24, opacity: 0, duration: reduceMotion ? 0 : 140, easing: cubicIn }}
  >
    <div
      class="pointer-events-auto max-h-full w-[340px] max-w-full overflow-y-auto rounded-glass-lg bg-glass p-3 shadow-[var(--glass-lighting),0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur transition-[width] duration-200 max-sm:w-full {importOpen
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
          aria-label={m["editor.dock_collapse"]()}
          title={m["editor.dock_collapse"]()}
          onclick={toggleExpansion}
        >
          <ChevronDown class="size-4" />
        </button>
      </div>

      <div class="mt-3 flex flex-col items-stretch gap-2">
        {#if editing}
          {#if !createMode}
            <button class="{btnBar} w-full" type="button" onclick={() => onSetMode("view")}>
              <Eye class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.view"]()}
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
              disabled={model.busy}
              onclick={() => void model.saveAsSharedNow()}
            >
              <Copy class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.save_as_shared"]()}
            </button>
          {/if}
        {:else}
          <button class="{btnPrimary} w-full" type="button" onclick={() => onSetMode("edit")}>
            <Pencil class="size-4 shrink-0" aria-hidden="true" />
            {model.dirty ? m["editor.continue_edit"]() : m["editor.enter_table"]()}
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
            {m["editor.discard_unsaved"]()}
          </button>
        {/if}
      </div>

      {#if tableActions}
        <div class="mt-3 border-t border-white-15 pt-2">
          <ToggleButton
            expanded={tableActionsOpen}
            label={m["editor.dock_table_actions"]()}
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
            label={m["editor.import_section"]()}
            onToggle={toggleImport}
          />
          {#if importOpen}
            <div class="mt-2">
              {@render importSection()}
            </div>
          {/if}
        </div>
      {/if}

      {#if editing && model.draftStatusText !== ""}
        <p class="mt-2 text-center text-[0.85rem] text-white-50">{model.draftStatusText}</p>
      {/if}

      {#if model.pendingDraft !== null}
        <div class="mt-3 border-t border-white-15 pt-3 text-center">
          <p class="text-[1.05rem] text-amber-200">{m["editor.draft_found_title"]()}</p>
          <p class="mx-auto mt-2 max-w-120 text-[0.9rem] text-white-65">
            {m["editor.draft_found_desc"]({ time: model.formatClock(model.pendingDraft.savedAt) })}
          </p>
          <div class="mt-3 flex flex-wrap justify-center gap-3">
            <button class={btnPrimary} type="button" onclick={model.restorePendingDraft}>
              <History class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.draft_restore"]()}
            </button>
            <button
              class={btnGhostMd}
              type="button"
              onclick={() => void model.discardPendingDraft()}
            >
              <Trash2 class="size-4 shrink-0" aria-hidden="true" />
              {m["editor.draft_discard"]()}
            </button>
          </div>
        </div>
      {/if}

      {#if model.notice !== null}
        <div
          class="mt-3 rounded-lg border px-3 py-2 text-center text-[0.85rem] {model.notice.kind ===
          'ok'
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
  <button
    class="fixed right-4 z-999 flex items-center gap-2 rounded-full bg-glass px-3.5 py-2 shadow-[var(--glass-lighting),0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur"
    style="bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem)"
    type="button"
    aria-label={m["editor.dock_expand"]()}
    title={m["editor.dock_expand"]()}
    onclick={toggleExpansion}
    onfocusin={handleFocusIn}
    onfocusout={handleFocusOut}
    in:fly={{ y: 24, opacity: 0, duration: reduceMotion ? 0 : 180, easing: cubicOut }}
    out:fly={{ y: 24, opacity: 0, duration: reduceMotion ? 0 : 140, easing: cubicIn }}
  >
    {#if editing}
      <Pencil class="size-4 text-white-80" aria-hidden="true" />
    {:else}
      <Eye class="size-4 text-white-80" aria-hidden="true" />
    {/if}
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
  </button>
{/if}
