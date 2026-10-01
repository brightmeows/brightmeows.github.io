<script lang="ts">
  import {
    checkSharedPayload,
    validateSharedId,
    withLocalDataUrl,
  } from "@brightmeows/mirror/shared";
  import { sharedTablePath } from "@brightmeows/mirror/urls";
  import { onMount } from "svelte";

  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import SharedEntryTable from "$lib/components/bms/SharedEntryTable.svelte";
  import SharedHeaderForm from "$lib/components/bms/SharedHeaderForm.svelte";
  import SharedImportPanel from "$lib/components/bms/SharedImportPanel.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { r2SharedDataUrl, r2SharedHeaderUrl } from "$lib/constants/r2";
  import { SITE_ORIGIN, apiBase } from "$lib/constants/site";
  import { auth } from "$lib/data/auth-store.svelte";
  import { fetchBmsHeader, fetchBmsTableData } from "$lib/data/bms-data";
  import {
    fetchSharedCheckId,
    loadSharedTables,
    submitSharedCreate,
    submitSharedDelete,
    submitSharedRename,
    submitSharedSave,
  } from "$lib/data/shared-api";
  import { sharedNewSeed } from "$lib/data/shared-new.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { clipboardFeedback } from "$lib/utils/clipboard.svelte";
  import { downloadJsonFile } from "$lib/utils/download";
  import {
    levelOrderToText,
    sharedPayloadErrorMessage,
    textToLevelOrder,
  } from "$lib/utils/shared-table";
  import { formatTitle } from "$lib/utils/title";

  /**
   * 共享表编辑器：整包编辑（头部核心子集 + 条目表 + 导入面板），
   * 首次保存走创建（D1 占位先行）、之后为覆盖保存；改 id 保留旧地址 301。
   * 权限：仅作者可进（admin 也不编辑他人内容）；服务端为准，这里只做显隐。
   */
  const tableId = $derived(page.params.id ?? "");

  type Mode = "loading" | "login" | "unavailable" | "forbidden" | "notfound" | "ready" | "error";

  let mode = $state<Mode>("loading");
  let loadError = $state<string | null>(null);
  let isNew = $state(false);
  let itemAuthor = $state("");

  let hName = $state("");
  let hSymbol = $state("");
  let hTag = $state("");
  let hMode = $state("");
  let hLevelOrderText = $state("");
  let extraHeader = $state<Record<string, unknown>>({});
  let entries = $state<Record<string, unknown>[]>([]);

  let dirty = $state(false);
  let busy = $state(false);
  let notice = $state<{ kind: "ok" | "error"; text: string } | null>(null);
  let newIdInput = $state("");
  let loginHref = $state("/api/auth/login");

  let cb = clipboardFeedback();

  // 忙碌时锁表单（头部、条目与导入入口一并禁用）
  const disabled = $derived(busy);

  const viewerUrl = $derived(sharedTablePath(tableId));
  const extraJson = $derived(JSON.stringify(extraHeader, null, 2));
  const courseCount = $derived(countCourses(extraHeader.course));

  function countCourses(value: unknown): number {
    if (!Array.isArray(value)) return 0;
    let count = 0;
    for (const element of value) {
      if (Array.isArray(element)) count += element.length;
      else if (element !== null && typeof element === "object") count += 1;
    }
    return count;
  }

  function str(value: unknown): string {
    return typeof value === "string"
      ? value
      : value === undefined || value === null
        ? ""
        : String(value);
  }

  /** 表头（可编辑子集）→ 载荷：未编辑字段从 extraHeader 原样带出。 */
  function buildHeader(): Record<string, unknown> {
    const header: Record<string, unknown> = { ...extraHeader };
    header.name = hName.trim();
    header.symbol = hSymbol.trim();
    const tag = hTag.trim();
    if (tag !== "") header.tag = tag;
    const order = textToLevelOrder(hLevelOrderText);
    if (order !== undefined) header.level_order = order;
    const modeValue = hMode.trim();
    if (modeValue !== "") header.mode = modeValue;
    return header;
  }

  function applyHeader(header: Record<string, unknown>): void {
    hName = str(header.name);
    hSymbol = str(header.symbol);
    hTag = str(header.tag);
    hMode = str(header.mode);
    hLevelOrderText = levelOrderToText(header.level_order);
    const next: Record<string, unknown> = { ...header };
    for (const key of ["name", "symbol", "tag", "mode", "level_order", "data_url"]) {
      delete next[key];
    }
    extraHeader = next;
  }

  function applyImport(
    header: Record<string, unknown>,
    data: Record<string, unknown>[],
    source: string
  ): void {
    applyHeader(header);
    entries = data;
    dirty = true;
    notice = { kind: "ok", text: m["shared.import_done"]({ source }) };
  }

  async function load(): Promise<void> {
    mode = "loading";
    notice = null;
    await auth.ensureLoaded();
    if (auth.status === "unavailable") {
      mode = "unavailable";
      return;
    }
    if (auth.user === null) {
      mode = "login";
      return;
    }
    let available: boolean;
    try {
      const check = await fetchSharedCheckId(tableId);
      available = check.available;
    } catch (e) {
      mode = "error";
      loadError = e instanceof Error ? e.message : m["common.unknown_error"]();
      return;
    }
    if (available) {
      isNew = true;
      const seed = sharedNewSeed.take();
      hName = seed.name;
      hSymbol = seed.symbol;
      entries = [];
      extraHeader = {};
      dirty = false;
      mode = "ready";
      return;
    }
    let items;
    try {
      items = await loadSharedTables();
    } catch (e) {
      mode = "error";
      loadError = e instanceof Error ? e.message : m["common.unknown_error"]();
      return;
    }
    const item = items.find((entry) => entry.id === tableId);
    if (item === undefined) {
      mode = "notfound";
      return;
    }
    if (item.author !== (auth.user?.login ?? "")) {
      mode = "forbidden";
      return;
    }
    itemAuthor = item.author;
    isNew = false;
    try {
      const headerUrl = r2SharedHeaderUrl(tableId);
      const header = await fetchBmsHeader(headerUrl);
      applyHeader(header as Record<string, unknown>);
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== ""
          ? header.data_url
          : r2SharedDataUrl(tableId);
      const dataResult = await fetchBmsTableData(dataUrl, headerUrl);
      entries = dataResult.data.map((chart) => ({ ...chart }));
      dirty = false;
      mode = "ready";
    } catch (e) {
      mode = "error";
      loadError = e instanceof Error ? e.message : m["common.unknown_error"]();
    }
  }

  async function save(): Promise<void> {
    if (busy) return;
    const header = buildHeader();
    const check = checkSharedPayload(header, entries);
    if (!check.ok) {
      notice = { kind: "error", text: sharedPayloadErrorMessage(check.error) };
      return;
    }
    const creating = isNew;
    busy = true;
    notice = null;
    try {
      const payload = { id: tableId, header: check.header, data: check.data };
      if (creating) {
        const result = await submitSharedCreate(payload);
        isNew = false;
        itemAuthor = auth.user?.login ?? "";
        notice = { kind: "ok", text: m["shared.created"]({ id: result.id }) };
      } else {
        await submitSharedSave(payload);
        notice = { kind: "ok", text: m["shared.saved"]({ count: check.data.length }) };
      }
      dirty = false;
      newIdInput = "";
    } catch (e) {
      notice = { kind: "error", text: e instanceof Error ? e.message : m["shared.save_failed"]() };
    } finally {
      busy = false;
    }
  }

  async function doRename(): Promise<void> {
    if (busy) return;
    const result = validateSharedId(newIdInput);
    if (!result.ok) {
      notice = { kind: "error", text: m["shared.rename_invalid"]() };
      return;
    }
    if (result.id === tableId) {
      notice = { kind: "error", text: m["shared.rename_same"]() };
      return;
    }
    if (!window.confirm(m["shared.rename_confirm"]({ from: tableId, to: result.id }))) return;
    busy = true;
    notice = null;
    try {
      await submitSharedRename(tableId, result.id);
      // 整页跳转：编辑器状态围绕旧 id 组织，重载最稳妥（id 与地址栏一致）
      window.location.assign(`${sharedTablePath(result.id)}edit/`);
    } catch (e) {
      notice = {
        kind: "error",
        text: e instanceof Error ? e.message : m["shared.rename_failed"](),
      };
      busy = false;
    }
  }

  async function doDelete(): Promise<void> {
    if (busy || isNew) return;
    if (!window.confirm(m["shared.delete_confirm"]({ name: hName || tableId }))) return;
    busy = true;
    notice = null;
    try {
      await submitSharedDelete(tableId);
      await goto("/bms/table/shared/");
    } catch (e) {
      notice = {
        kind: "error",
        text: e instanceof Error ? e.message : m["shared.delete_failed"](),
      };
      busy = false;
    }
  }

  function downloadCurrent(): void {
    downloadJsonFile("header.json", withLocalDataUrl(buildHeader()));
    downloadJsonFile("data.json", entries);
  }

  // 离开警告：有未保存修改时挡一次误关（整包覆盖写，丢失即不可恢复）
  $effect(() => {
    if (!dirty || mode !== "ready") return;
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  });

  onMount(() => {
    void load();
    const returnTo = `${window.location.pathname}`;
    loginHref = `${apiBase()}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
  });

  const primaryButton =
    "cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass =
    "w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono text-[0.9rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60";
</script>

<svelte:head>
  <title>{formatTitle(isNew ? m["shared.new_title"]() : tableId)}</title>
</svelte:head>

<PageShell
  panes={[titlePane, contentPane]}
  currentLabel={isNew ? m["shared.new_title"]() : tableId}
/>

{#snippet titlePane()}
  <div class="text-center">
    <h1 class="page-title mb-1">{isNew ? m["shared.new_title"]() : tableId}</h1>
    {#if itemAuthor !== ""}
      <div class="text-[1rem] text-white/60">{m["shared.author_label"]({ name: itemAuthor })}</div>
    {/if}
    <div class="mt-2 text-[1rem] text-white/70 italic">
      {#if isNew}
        {m["shared.editor_new_hint"]()}
      {:else}
        {m["shared.editor_url_hint"]()}
        <span class="font-mono text-[0.9rem] break-all text-white/85">{viewerUrl}</span>
        <button class="link-accent" type="button" onclick={() => cb.copy(viewerUrl)}>
          {m["common.click_copy"]()}
        </button>
        {#if cb.copied}
          <span class="ml-2 text-[#4caf50]">{m["common.copied"]()}</span>
        {/if}
      {/if}
    </div>
    {#if dirty}
      <div class="mt-2 text-[0.9rem] text-amber-300">{m["shared.unsaved_badge"]()}</div>
    {/if}
  </div>
{/snippet}

{#snippet contentPane()}
  <GlassPanel>
    {#if mode === "loading"}
      <LoadingProgress
        variant="indeterminate"
        message={m["shared.editor_loading"]()}
        title={m["shared.new_title"]()}
      />
    {:else if mode === "login"}
      <div class="flex flex-col items-center gap-4 py-6 text-center">
        <p class="text-[1rem] text-white/75">{m["shared.login_required"]()}</p>
        <a class={primaryButton} href={loginHref}>{m["topbar.login"]()}</a>
      </div>
    {:else if mode === "unavailable"}
      <div class="py-6 text-center text-[0.95rem] text-white/75">
        {m["mirror.api_unavailable_before"]()}
        <a
          class="link-accent"
          href={`${SITE_ORIGIN}${viewerUrl}edit/`}
          target="_blank"
          rel="noopener noreferrer">{m["mirror.api_unavailable_link"]()}</a
        >{m["mirror.api_unavailable_after"]()}
      </div>
    {:else if mode === "forbidden"}
      <div class="py-6 text-center">
        <p class="text-[1.05rem] text-red-300">{m["shared.forbidden"]()}</p>
        <a class="link-accent mt-3 inline-block" href={viewerUrl}>{m["shared.back_to_viewer"]()}</a>
      </div>
    {:else if mode === "notfound"}
      <div class="py-6 text-center">
        <p class="text-[1.05rem] text-red-300">{m["shared.not_found"]()}</p>
        <p class="mt-2 text-[0.9rem] text-white/60">{m["shared.not_found_hint"]()}</p>
        <a class="link-accent mt-3 inline-block" href="/bms/table/shared/">
          {m["shared.back_to_list"]()}
        </a>
      </div>
    {:else if mode === "error"}
      <div class="py-6 text-center">
        <p class="text-[1.05rem] text-red-300">
          {m["common.load_failed_with_error"]({ error: loadError ?? m["common.unknown_error"]() })}
        </p>
        <button class="{smallButton} mt-3" type="button" onclick={() => void load()}>
          {m["common.reload"]()}
        </button>
      </div>
    {:else}
      <div class="flex flex-col gap-8">
        <SharedImportPanel {disabled} onApply={applyImport} />

        <hr class="border-white/10" />

        <SharedHeaderForm
          bind:name={hName}
          bind:symbol={hSymbol}
          bind:tag={hTag}
          bind:mode={hMode}
          bind:levelOrderText={hLevelOrderText}
          {courseCount}
          {extraJson}
          {disabled}
        />

        <hr class="border-white/10" />

        <SharedEntryTable bind:entries {disabled} onchange={() => (dirty = true)} />

        <hr class="border-white/10" />

        {#if notice}
          <div
            class="text-center text-[0.95rem] {notice.kind === 'ok'
              ? 'text-[#4caf50]'
              : 'text-red-300'}"
          >
            {notice.text}
          </div>
        {/if}

        <div class="flex flex-wrap items-center justify-center gap-3">
          <button class={primaryButton} type="button" disabled={busy} onclick={() => void save()}>
            {busy
              ? m["shared.saving"]()
              : isNew
                ? m["shared.create_confirm"]()
                : m["shared.save"]()}
          </button>
          <button class={smallButton} type="button" disabled={busy} onclick={downloadCurrent}>
            {m["shared.download_current"]()}
          </button>
          {#if !isNew}
            <button
              class={smallButton}
              type="button"
              disabled={busy}
              onclick={() => void doDelete()}
            >
              {m["shared.actions_delete"]()}
            </button>
          {/if}
        </div>

        {#if !isNew}
          <div class="rounded-lg border border-white/15 bg-black/20 p-3">
            <div class="mb-2 text-[0.9rem] text-white/70">{m["shared.rename_section"]()}</div>
            <div class="flex flex-wrap gap-2">
              <input
                class="{inputClass} min-w-50 flex-1"
                type="text"
                bind:value={newIdInput}
                placeholder={m["shared.rename_placeholder"]({ id: tableId })}
                disabled={busy}
              />
              <button
                class={smallButton}
                type="button"
                disabled={busy}
                onclick={() => void doRename()}
              >
                {m["shared.rename_button"]()}
              </button>
            </div>
            <p class="mt-2 text-[0.8rem] text-white/50">{m["shared.rename_hint"]()}</p>
          </div>
        {/if}
      </div>
    {/if}
  </GlassPanel>
{/snippet}
