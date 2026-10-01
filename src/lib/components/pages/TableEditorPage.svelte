<script lang="ts">
  import { withLocalDataUrl } from "@brightmeows/mirror/shared";
  import { onMount } from "svelte";

  import TableEntryEditor from "$lib/components/bms/TableEntryEditor.svelte";
  import TableHeaderForm from "$lib/components/bms/TableHeaderForm.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { fetchBmsHeader, fetchBmsTableData } from "$lib/data/bms-data";
  import { deleteDraft, loadDraft, saveDraft } from "$lib/data/table-drafts";
  import { m } from "$lib/paraglide/messages.js";
  import { downloadJsonFile } from "$lib/utils/download";
  import {
    buildCombinedPackage,
    countUnassigned,
    levelOrderOf,
    type DraftPayload,
  } from "$lib/utils/table-editor";
  import { formatTitle } from "$lib/utils/title";
  import { resolveUrl } from "$lib/utils/url";

  /**
   * 表编辑器页面：加载 header 与 data 后进入本地编辑（草稿、导出）。
   * 阶段一只做本地闭环：草稿按表键存 IndexedDB，导出标准两份与合并包；
   * 另存共享表与共享保存（阶段二）会在此基础上接入。
   */
  interface Props {
    /** header.json 地址（镜像 R2 或站内自托管）。 */
    headerUrl: string;
    /** header.data_url 缺失时的回退数据地址。 */
    dataUrlFallback: string;
    /** 草稿键（按来源生成，见 draftStorageKey）。 */
    draftKey: string;
    /** 查看页地址（返回与查看入口）。 */
    viewerHref: string;
  }

  let { headerUrl, dataUrlFallback, draftKey, viewerHref }: Props = $props();

  type LoadState = "loading" | "ready" | "error";
  type DraftStatus = "idle" | "saving" | "saved" | "unavailable" | "quota" | "error";

  let loadState = $state<LoadState>("loading");
  let loadError = $state<string | null>(null);
  let loadPercent = $state(0);
  let loadMessage = $state<string>(m["editor.loading"]());
  let loadDetail = $state("");

  let name = $state("");
  let symbol = $state("");
  let tag = $state("");
  let mode = $state("");
  let levels = $state<string[]>([]);
  let extraHeader = $state<Record<string, unknown>>({});
  let entries = $state<Record<string, unknown>[]>([]);

  let dirty = $state(false);
  let pendingDraft = $state<DraftPayload | null>(null);
  let draftStatus = $state<DraftStatus>("idle");
  let lastSavedAt = $state<string | null>(null);
  let exportNotice = $state<{ kind: "warn" | "error"; text: string } | null>(null);

  const unassignedCount = $derived(countUnassigned(entries));
  const pageTitle = $derived(name.trim() === "" ? m["editor.page_title"]() : name.trim());
  const headTitle = $derived(
    name.trim() === "" ? m["editor.page_title"]() : `${m["editor.page_title"]()}: ${name.trim()}`
  );
  const extraJson = $derived(JSON.stringify(extraHeader, null, 2));
  const draftGuardActive = $derived(
    dirty && (draftStatus === "unavailable" || draftStatus === "quota" || draftStatus === "error")
  );

  const draftStatusText = $derived.by(() => {
    switch (draftStatus) {
      case "saving":
        return m["editor.draft_saving"]();
      case "saved":
        return lastSavedAt === null
          ? ""
          : m["editor.draft_saved_at"]({ time: formatClock(lastSavedAt) });
      case "unavailable":
      case "quota":
        return m["editor.draft_unavailable"]();
      case "error":
        return m["editor.draft_error"]();
      default:
        return "";
    }
  });

  function formatClock(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
  }

  function str(value: unknown): string {
    return typeof value === "string"
      ? value
      : value === undefined || value === null
        ? ""
        : String(value);
  }

  /** 头部可编辑子集之外的字段原样保留（course、level_ref、data_url 等）。 */
  function splitHeader(header: Record<string, unknown>): {
    core: { name: string; symbol: string; tag: string; mode: string };
    extra: Record<string, unknown>;
  } {
    const extra = { ...header };
    for (const key of ["name", "symbol", "tag", "mode", "level_order"]) delete extra[key];
    return {
      core: {
        name: str(header.name),
        symbol: str(header.symbol),
        tag: str(header.tag),
        mode: str(header.mode),
      },
      extra,
    };
  }

  function buildHeader(): Record<string, unknown> {
    const header = { ...extraHeader };
    header.name = name.trim();
    header.symbol = symbol.trim();
    const trimmedTag = tag.trim();
    if (trimmedTag !== "") header.tag = trimmedTag;
    else delete header.tag;
    const trimmedMode = mode.trim();
    if (trimmedMode !== "") header.mode = trimmedMode;
    else delete header.mode;
    if (levels.length > 0) header.level_order = [...levels];
    else delete header.level_order;
    return header;
  }

  function markDirty(): void {
    dirty = true;
    exportNotice = null;
  }

  async function load(): Promise<void> {
    loadState = "loading";
    loadError = null;
    loadPercent = 0;
    loadMessage = m["editor.loading"]();
    loadDetail = "";
    try {
      const header = await fetchBmsHeader(headerUrl, (event) => {
        loadPercent = event.percent;
        loadMessage = event.message;
        loadDetail = event.detail ?? "";
      });
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== ""
          ? header.data_url
          : dataUrlFallback;
      const result = await fetchBmsTableData(dataUrl, resolveUrl(headerUrl), (event) => {
        loadPercent = event.percent;
        loadMessage = event.message;
        loadDetail = event.detail ?? "";
      });

      const split = splitHeader(header as Record<string, unknown>);
      name = split.core.name;
      symbol = split.core.symbol;
      tag = split.core.tag;
      mode = split.core.mode;
      levels = levelOrderOf(header as Record<string, unknown>);
      extraHeader = split.extra;
      entries = result.data.map((item) => ({ ...item }));
      dirty = false;
      pendingDraft = null;
      draftStatus = "idle";
      loadState = "ready";

      const draft = await loadDraft(draftKey);
      if (draft !== null) pendingDraft = draft;
    } catch (error) {
      loadError = error instanceof Error ? error.message : m["common.unknown_error"]();
      loadState = "error";
    }
  }

  function restorePendingDraft(): void {
    const draft = pendingDraft;
    if (draft === null) return;
    const split = splitHeader(draft.header);
    name = split.core.name;
    symbol = split.core.symbol;
    tag = split.core.tag;
    mode = split.core.mode;
    levels = levelOrderOf(draft.header);
    extraHeader = split.extra;
    entries = draft.data.map((item) => ({ ...item }));
    pendingDraft = null;
    dirty = true;
    draftStatus = "saved";
    lastSavedAt = draft.savedAt;
    exportNotice = null;
  }

  async function discardPendingDraft(): Promise<void> {
    await deleteDraft(draftKey);
    pendingDraft = null;
  }

  // 草稿自动落盘：防抖 1.2 秒；结构克隆直存 IndexedDB，不额外做文本序列化。
  $effect(() => {
    if (!dirty || loadState !== "ready" || pendingDraft !== null) return;
    const payload: DraftPayload = {
      header: buildHeader(),
      data: entries,
      savedAt: new Date().toISOString(),
      baselineUpdatedAt: undefined,
    };
    const timer = setTimeout(() => {
      void persistDraft(payload);
    }, 1200);
    return () => clearTimeout(timer);
  });

  async function persistDraft(payload: DraftPayload): Promise<void> {
    draftStatus = "saving";
    // Svelte 5 的 $state 是深层代理，IndexedDB 结构克隆不接受代理对象，先取静态快照
    const result = await saveDraft(draftKey, $state.snapshot(payload));
    if (result === "ok") {
      draftStatus = "saved";
      lastSavedAt = payload.savedAt;
    } else {
      draftStatus = result;
    }
  }

  // 草稿不可用时退回离页警告（草稿可用时无警告，防误关由草稿承担）。
  $effect(() => {
    if (!draftGuardActive) return;
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  });

  function ensureValid(): boolean {
    if (name.trim() === "" || symbol.trim() === "") {
      exportNotice = { kind: "error", text: m["editor.export_missing_identity"]() };
      return false;
    }
    return true;
  }

  function noteUnassigned(): void {
    exportNotice =
      unassignedCount > 0
        ? {
            kind: "warn",
            text: m["editor.export_unassigned_warning"]({ count: unassignedCount }),
          }
        : null;
  }

  function exportHeader(): void {
    if (!ensureValid()) return;
    noteUnassigned();
    downloadJsonFile("header.json", withLocalDataUrl(buildHeader()));
  }

  function exportData(): void {
    if (!ensureValid()) return;
    noteUnassigned();
    downloadJsonFile("data.json", entries);
  }

  function exportPackage(): void {
    if (!ensureValid()) return;
    noteUnassigned();
    downloadJsonFile(
      "table-package.json",
      buildCombinedPackage(withLocalDataUrl(buildHeader()), entries)
    );
  }

  onMount(() => {
    void load();
  });

  const primaryButton =
    "cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
</script>

<svelte:head>
  <title>{formatTitle(headTitle)}</title>
</svelte:head>

<PageShell
  currentLabel={pageTitle}
  panes={loadState === "ready" ? [titlePane, contentPane] : [titlePane, loadPane]}
/>

{#snippet titlePane()}
  <div class="text-center">
    <h1 class="page-title mb-2">{pageTitle}</h1>
    <div class="text-[1.05rem] text-white/70 italic">{m["editor.mode_badge"]()}</div>
    <div class="mt-2 text-[0.95rem] text-white/60">
      <a class="link-accent" href={viewerHref}>{m["editor.back_to_view"]()}</a>
      {#if dirty}
        <span class="ml-3 text-amber-300">{m["editor.unsaved_badge"]()}</span>
      {/if}
    </div>
    {#if loadState === "ready" && draftStatusText !== ""}
      <div class="mt-2 text-[0.85rem] text-white/45">{draftStatusText}</div>
    {/if}
  </div>
{/snippet}

{#snippet loadPane()}
  {#if loadState === "loading"}
    <div class="p-8">
      <LoadingProgress
        title={m["editor.page_title"]()}
        message={loadMessage}
        progress={loadPercent}
        detail={loadDetail}
        variant="determinate"
      />
    </div>
  {:else}
    <div class="p-12 text-center">
      <h3 class="mb-4 text-error">{m["common.load_failed"]()}</h3>
      <p class="message-error my-6">{loadError ?? m["common.unknown_error"]()}</p>
      <p class="mb-6 text-white/70">{m["common.check_network"]()}</p>
      <button class={primaryButton} type="button" onclick={() => void load()}>
        {m["common.reload"]()}
      </button>
    </div>
  {/if}
{/snippet}

{#snippet contentPane()}
  {#if pendingDraft !== null}
    <div class="py-6 text-center">
      <p class="text-[1.05rem] text-amber-200">{m["editor.draft_found_title"]()}</p>
      <p class="mx-auto mt-2 max-w-120 text-[0.9rem] text-white/65">
        {m["editor.draft_found_desc"]({ time: formatClock(pendingDraft.savedAt) })}
      </p>
      <div class="mt-5 flex flex-wrap justify-center gap-3">
        <button class={primaryButton} type="button" onclick={restorePendingDraft}>
          {m["editor.draft_restore"]()}
        </button>
        <button class={smallButton} type="button" onclick={() => void discardPendingDraft()}>
          {m["editor.draft_discard"]()}
        </button>
      </div>
    </div>
  {:else}
    <div class="flex flex-col gap-8">
      {#if exportNotice !== null}
        <div
          class="rounded-lg border px-3 py-2 text-[0.9rem] {exportNotice.kind === 'warn'
            ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
            : 'border-red-400/40 bg-red-400/10 text-red-200'}"
        >
          {exportNotice.text}
        </div>
      {/if}

      <TableHeaderForm
        bind:name
        bind:symbol
        bind:tag
        bind:mode
        bind:levels
        {extraJson}
        onchange={markDirty}
      />

      <hr class="border-white/10" />

      <TableEntryEditor bind:entries {levels} onchange={markDirty} />

      <hr class="border-white/10" />

      <section>
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <h3 class="tag-accent-sm">{m["editor.export_section"]()}</h3>
          <span class="text-[0.85rem] text-white/50">{m["editor.export_hint"]()}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class={smallButton} type="button" onclick={exportHeader}>
            {m["editor.export_header"]()}
          </button>
          <button class={smallButton} type="button" onclick={exportData}>
            {m["editor.export_data"]()}
          </button>
          <button class={smallButton} type="button" onclick={exportPackage}>
            {m["editor.export_package"]()}
          </button>
        </div>
      </section>
    </div>
  {/if}
{/snippet}
