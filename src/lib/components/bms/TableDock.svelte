<script lang="ts">
  import { onMount } from "svelte";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";

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
   * - 常驻右下角：收起态是模式胶囊（图标加状态词与色点：琥珀=未保存、
   *   红/绿=notice、浅蓝=待恢复草稿，error/warn 额外以彩色短词提示），
   *   展开态是 340px 玻璃面板（窄屏回退全宽），面板头为同一状态标识，
   *   下方纵排承载模式切换、保存、另存、放弃、notice、草稿横幅与
   *   自动保存时刻；
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
    /** “编辑此表”按钮的悬停提示文案。 */
    editHint: string;
    /** 模式切换回调：页面实现切换后的滚回页首。 */
    onSetMode: (next: DockMode) => void;
  }

  let { model, mode, createMode, showSaveAsShared, editHint, onSetMode }: Props = $props();

  /** 成功类 notice 的自动清除时延；warn 与 error 常驻到被下一次替换。 */
  const NOTICE_OK_TTL_MS = 8000;

  let editing = $derived(mode === "edit");

  /** 面板头与收起胶囊共用的模式状态词。 */
  let stateWord = $derived(
    editing ? m["editor.dock_state_editing"]() : m["editor.dock_state_viewing"]()
  );

  /** 收起态与面板头上的 notice 短词（ok 类不提示，8 秒自动清除）。 */
  let noticeWord = $derived.by(() => {
    if (model.notice === null) return null;
    if (model.notice.kind === "error") {
      return { text: m["editor.dock_notice_error"](), cls: "text-red-300" };
    }
    if (model.notice.kind === "warn") {
      return { text: m["editor.dock_notice_warn"](), cls: "text-amber-300" };
    }
    return null;
  });

  // ---- 收展状态：滚动累积无需触发渲染，放普通变量；expansion 单独响应式 ----
  // svelte-ignore state_referenced_locally —— 初值取挂载时的模式；模式变化由下方 effect 重置
  let scrollState = createDockScrollState(mode);
  let expansion = $state<DockExpansion>(scrollState.expansion);
  let keyboardFocus = $state(false);
  let lastScrollY = 0;
  let reduceMotion = $state(false);

  // 模式变化重置初值（挂载时同样执行一次，与初始化等价）
  $effect(() => {
    scrollState = createDockScrollState(mode);
    expansion = scrollState.expansion;
  });

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

  // 收起态胶囊的状态色点：与展开态内容一一对应，多状态并存时全部显示
  let dockSignals = $derived.by(() => {
    const signals: { color: string; title: string }[] = [];
    if (model.dirty) {
      signals.push({ color: "bg-amber-300", title: m["editor.unsaved_badge"]() });
    }
    if (model.notice !== null) {
      signals.push({
        color:
          model.notice.kind === "error"
            ? "bg-red-400"
            : model.notice.kind === "ok"
              ? "bg-success"
              : "bg-amber-300",
        title: model.notice.text,
      });
    }
    if (model.pendingDraft !== null) {
      signals.push({ color: "bg-accent-light", title: m["editor.draft_found_title"]() });
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
      class="pointer-events-auto w-[340px] max-w-full rounded-xl bg-glass p-3 shadow-[var(--glass-lighting),0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur max-sm:w-full"
      onfocusin={handleFocusIn}
      onfocusout={handleFocusOut}
    >
      <div class="flex items-center justify-between gap-2 border-b border-white-15 pb-2">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {#if editing}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-4 shrink-0 text-white-80"
              aria-hidden="true"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-4 shrink-0 text-white-80"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          {/if}
          <span class="text-[0.9rem] text-white-85">{stateWord}</span>
          {#if model.dirty}
            <span class="text-[0.8rem] text-amber-300">{m["editor.dock_state_unsaved"]()}</span>
          {/if}
          {#if noticeWord !== null}
            <span class="text-[0.8rem] {noticeWord.cls}">{noticeWord.text}</span>
          {/if}
          {#each dockSignals as signal (signal.title)}
            <span class="size-2 rounded-full {signal.color}" title={signal.title}></span>
          {/each}
        </div>
        <button
          class="p-1 text-white-60 transition-colors duration-150 hover:text-white"
          type="button"
          aria-label={m["editor.dock_collapse"]()}
          title={m["editor.dock_collapse"]()}
          onclick={toggleExpansion}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <div class="mt-3 flex flex-col items-stretch gap-2">
        {#if editing}
          {#if !createMode}
            <button class="{btnBar} w-full" type="button" onclick={() => onSetMode("view")}>
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
              {m["editor.save_as_shared"]()}
            </button>
          {/if}
        {:else}
          <button
            class="{btnPrimary} w-full"
            type="button"
            title={editHint}
            onclick={() => onSetMode("edit")}
          >
            {model.dirty ? m["editor.continue_edit"]() : m["editor.enter_table"]()}
          </button>
        {/if}

        {#if model.dirty}
          {#if !editing && model.canSave}
            <button
              class="{btnPrimary} w-full"
              type="button"
              disabled={model.busy}
              onclick={() => void model.save()}
            >
              {model.saveLabel}
            </button>
          {/if}
          <button
            class="{btnGhostMd} w-full"
            type="button"
            disabled={model.busy}
            onclick={() => void model.discardEdits()}
          >
            {m["editor.discard_unsaved"]()}
          </button>
        {/if}
      </div>

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
              {m["editor.draft_restore"]()}
            </button>
            <button
              class={btnGhostMd}
              type="button"
              onclick={() => void model.discardPendingDraft()}
            >
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
              ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
              : 'border-red-400/40 bg-red-400/10 text-red-200'}"
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4 text-white-80"
        aria-hidden="true"
      >
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    {:else}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4 text-white-80"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    {/if}
    <span class="text-[0.85rem] whitespace-nowrap text-white-85">{stateWord}</span>
    {#if model.dirty}
      <span class="text-[0.8rem] whitespace-nowrap text-amber-300">
        {m["editor.dock_state_unsaved"]()}
      </span>
    {/if}
    {#if noticeWord !== null}
      <span class="text-[0.8rem] whitespace-nowrap {noticeWord.cls}">{noticeWord.text}</span>
    {/if}
    {#each dockSignals as signal (signal.title)}
      <span class="size-2 rounded-full {signal.color}" title={signal.title}></span>
    {/each}
  </button>
{/if}
