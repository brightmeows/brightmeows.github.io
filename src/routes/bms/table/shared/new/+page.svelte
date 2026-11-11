<script lang="ts">
  import { detectTableImportJson } from "@brightmeows/bms/editor";
  import { sharedIdPreview, type SharedNewTableSeedPayload } from "@brightmeows/bms/shared";
  import { validateSharedId, type SharedIdError } from "@brightmeows/mirror/shared";
  import type { SharedStrictError, SharedStrictWarning } from "@brightmeows/mirror/shared-strict";
  import {
    crossWarnings,
    strictCheckData,
    strictCheckHeader,
  } from "@brightmeows/mirror/shared-strict";
  import { onMount } from "svelte";

  import PageShell from "#lib/components/layout/PageShell.svelte";
  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import { btnGhost, btnPrimary, inputEditorMono, inputPanel } from "#lib/constants/ui-classes.js";
  import { strictErrorsNotice, strictWarningsNotice } from "#lib/controllers/editor.js";
  import { fetchSharedCheckId } from "#lib/data/api/shared-api.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
  import { sharedNewSeed } from "#lib/data/store/shared-new.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { goto } from "$app/navigation";

  /**
   * 新建前置屏：id 实时预览与异步查重（需登录），可顺带填 name/symbol 作
   * 编辑器种子，亦可导入头与数据（强验证后随种子带入编辑器）；确认后进入
   * 编辑器，首次保存才真正创建（D1 占位先行）。
   */
  let id = $state("");
  let name = $state("");
  let symbol = $state("");
  let origin = $state("");
  let loginHref = $state("/api/auth/login");
  let checkState = $state<"idle" | "checking" | "available" | "taken" | "aliased" | "failed">(
    "idle"
  );
  let busy = $state(false);

  // 导入段状态：分量独立判定，通过的部分入库并随种子带入编辑器。
  let importText = $state("");
  let importBusy = $state(false);
  let importedHeader = $state<Record<string, unknown> | null>(null);
  let importedData = $state<Record<string, unknown>[] | null>(null);
  let importErrors = $state<string | null>(null);
  let importWarnings = $state<string | null>(null);
  let importSummary = $state<string | null>(null);

  const idResult = $derived.by(() => {
    const raw = id.trim();
    if (raw === "") return null;
    return validateSharedId(raw);
  });
  const canonicalId = $derived(idResult?.ok === true ? idResult.id : "");
  const idError = $derived(idResult === null || idResult.ok ? null : idResult.error);

  // 动态 key 会被 i18n 覆盖检查当成死 key，这里用字面量分发
  function idErrorMessage(error: SharedIdError): string {
    switch (error) {
      case "empty":
        return m["shared.id_error_empty"]();
      case "too_long":
        return m["shared.id_error_too_long"]();
      case "charset":
        return m["shared.id_error_charset"]();
      case "reserved":
        return m["shared.id_error_reserved"]();
    }
  }

  const loggedIn = $derived(auth.status === "ready" && auth.user !== null);
  const preview = $derived(sharedIdPreview(canonicalId, origin));

  // 地址栏 origin 只在客户端有意义；预览在 SSR 期先渲染站内相对路径
  onMount(() => {
    origin = window.location.origin;
    // 从编辑器“另存为共享表”跳来时预填名称与符号（草稿认领由编辑器侧承担）
    const seed = sharedNewSeed.peek();
    name = seed.name;
    symbol = seed.symbol;
    void auth.ensureLoaded();
    const returnTo = `${window.location.pathname}`;
    loginHref = `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
  });

  // 输入停顿 500ms 后查重：登录前不发请求（登录引导由页面承担）
  $effect(() => {
    const candidate = canonicalId;
    if (candidate === "" || !loggedIn) {
      checkState = "idle";
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      checkState = "checking";
      fetchSharedCheckId(candidate)
        .then((result) => {
          if (cancelled) return;
          checkState = !result.available ? "taken" : result.wasAliased ? "aliased" : "available";
        })
        .catch(() => {
          if (!cancelled) checkState = "failed";
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  });

  /** 头部入库并预填身份表单（导入值作为初值，用户可改）。 */
  function storeImportedHeader(header: Record<string, unknown>): void {
    importedHeader = header;
    if (typeof header.name === "string" && header.name !== "") name = header.name;
    if (typeof header.symbol === "string" && header.symbol !== "") symbol = header.symbol;
  }

  /** 重算导入摘要与警告（分量警告加交叉一致性警告）。 */
  function refreshImportReport(): void {
    if (importedHeader === null && importedData === null) {
      importSummary = null;
      importWarnings = null;
      return;
    }
    const entries = importedData?.length ?? 0;
    const headerOrder = importedHeader?.level_order;
    let levels = 0;
    if (Array.isArray(headerOrder)) {
      levels = headerOrder.length;
    } else if (importedData !== null) {
      const distinct = new Set<string>();
      for (const item of importedData) {
        const level = item.level;
        if (typeof level === "string" && level !== "") distinct.add(level);
      }
      levels = distinct.size;
    }
    let courses = 0;
    const course = importedHeader?.course;
    if (Array.isArray(course)) {
      for (const item of course) courses += Array.isArray(item) ? item.length : 1;
    }
    const kind =
      importedHeader !== null && importedData !== null
        ? m["shared.import_kind_combined"]()
        : importedHeader !== null
          ? m["shared.import_kind_header"]()
          : (m["shared.import_kind_data"]() as string);
    importSummary = m["shared.import_summary"]({ kind, entries, levels, courses });
    const warnings: SharedStrictWarning[] = [];
    if (importedHeader !== null) warnings.push(...strictCheckHeader(importedHeader).warnings);
    if (importedData !== null) warnings.push(...strictCheckData(importedData).warnings);
    if (importedHeader !== null && importedData !== null) {
      warnings.push(...crossWarnings(importedHeader, importedData));
    }
    importWarnings = strictWarningsNotice(warnings);
  }

  /** 解析并强验证一段导入文本；分量独立判定，通过的部分入库。 */
  function applyImportText(text: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (parseError) {
      importErrors = m["editor.json_parse_failed"]({
        detail: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return;
    }
    const detected = detectTableImportJson(raw);
    if (detected.kind === "invalid") {
      importErrors = m["shared.import_invalid"]();
      return;
    }
    const errors: SharedStrictError[] = [];
    let truncated = false;
    let headerToStore: Record<string, unknown> | null = null;
    let dataToStore: Record<string, unknown>[] | null = null;
    if (detected.kind === "header" || detected.kind === "combined") {
      const report = strictCheckHeader(detected.header);
      errors.push(...report.errors);
      truncated = truncated || report.truncated;
      if (report.ok) headerToStore = detected.header;
    }
    if (detected.kind === "data" || detected.kind === "combined") {
      const report = strictCheckData(detected.data);
      errors.push(...report.errors);
      truncated = truncated || report.truncated;
      if (report.ok) dataToStore = report.entries;
    }
    importErrors = errors.length > 0 ? strictErrorsNotice({ errors, truncated }) : null;
    if (headerToStore !== null) storeImportedHeader(headerToStore);
    if (dataToStore !== null) importedData = dataToStore;
    refreshImportReport();
  }

  async function applyImportFile(file: File): Promise<void> {
    importBusy = true;
    try {
      applyImportText(await file.text());
    } finally {
      importBusy = false;
    }
  }

  function clearImport(): void {
    importedHeader = null;
    importedData = null;
    importErrors = null;
    importWarnings = null;
    importSummary = null;
    importText = "";
  }

  async function submit(): Promise<void> {
    if (idResult === null || !idResult.ok || busy) return;
    if (checkState === "aliased") {
      const ok = window.confirm(m["shared.id_was_aliased_confirm"]({ id: idResult.id }));
      if (!ok) return;
    }
    busy = true;
    try {
      sharedNewSeed.set(name.trim(), symbol.trim());
      if (importedHeader !== null || importedData !== null) {
        const overrides: Record<string, unknown> = {};
        if (name.trim() !== "") overrides.name = name.trim();
        if (symbol.trim() !== "") overrides.symbol = symbol.trim();
        const header = importedHeader !== null ? { ...importedHeader, ...overrides } : overrides;
        const payload: SharedNewTableSeedPayload = { header, data: importedData ?? [] };
        sharedNewSeed.setPayload(payload);
      }
      // 新表只在编辑态呈现：查看分支会去拉尚不存在的表头（R2 对象还没有）。
      // 带 ?edit=1 后共享表页先渲染 loading，等状态就绪再以空 headerUrl 进新表模式。
      await goto(`${preview}?edit=1`);
    } finally {
      busy = false;
    }
  }
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["shared.new_title"]()}</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white-70">{m["shared.new_subtitle"]()}</p>
{/snippet}

{#snippet contentPane()}
  <GlassPanel>
    {#if auth.status === "idle" || auth.status === "loading"}
      <LoadingProgress
        variant="indeterminate"
        message={m["shared.checking_auth"]()}
        title={m["shared.new_title"]()}
      />
    {:else if !loggedIn}
      <div class="flex flex-col items-center gap-4 py-4 text-center">
        <p class="text-[1rem] text-white-75">{m["shared.login_required"]()}</p>
        <a class={btnPrimary} href={loginHref}>{m["topbar.login"]()}</a>
      </div>
    {:else}
      <form
        class="flex flex-col gap-5"
        onsubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <label class="mb-1.5 block text-[0.95rem] text-white-80" for="shared-id">
            {m["shared.id_label"]()}
          </label>
          <input
            class={inputPanel}
            id="shared-id"
            type="text"
            bind:value={id}
            placeholder={m["shared.id_placeholder"]()}
            autocomplete="off"
          />
          <p class="mt-1.5 text-[0.85rem] text-white-50">{m["shared.id_hint"]()}</p>
          {#if idError !== null}
            <p class="mt-2 text-[0.9rem] text-error">{idErrorMessage(idError)}</p>
          {/if}
        </div>

        <div class="rounded-lg border border-white-15 bg-black-20 p-3">
          <div class="text-[0.85rem] text-white-50">{m["shared.id_preview_label"]()}</div>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <code class="font-mono text-[0.95rem] break-all text-accent">{preview}</code>
          </div>
          <div class="mt-2 text-[0.9rem]">
            {#if checkState === "checking"}
              <span class="text-white-60">{m["shared.id_checking"]()}</span>
            {:else if checkState === "available"}
              <span class="text-success">{m["shared.id_available"]()}</span>
            {:else if checkState === "aliased"}
              <span class="text-amber-300">{m["shared.id_was_aliased"]()}</span>
            {:else if checkState === "taken"}
              <span class="text-error">{m["shared.id_taken"]()}</span>
            {:else if checkState === "failed"}
              <span class="text-error">{m["shared.id_check_failed"]()}</span>
            {/if}
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-[0.95rem] text-white-80" for="shared-name">
              {m["shared.field_name"]()}
            </label>
            <input
              class={inputPanel}
              id="shared-name"
              type="text"
              bind:value={name}
              placeholder={m["shared.seed_name_placeholder"]()}
            />
          </div>
          <div>
            <label class="mb-1.5 block text-[0.95rem] text-white-80" for="shared-symbol">
              {m["shared.field_symbol"]()}
            </label>
            <input
              class={inputPanel}
              id="shared-symbol"
              type="text"
              bind:value={symbol}
              placeholder={m["shared.seed_symbol_placeholder"]()}
            />
          </div>
        </div>
        <p class="-mt-2 text-[0.85rem] text-white-50">{m["shared.seed_hint"]()}</p>

        <details class="rounded-lg border border-white-15 bg-black-20 p-3">
          <summary class="cursor-pointer text-[0.9rem] text-white-70">
            {m["shared.import_section"]()}
          </summary>
          <p class="mt-2 text-[0.85rem] text-white-60">{m["shared.import_hint"]()}</p>
          <textarea
            class="mt-2 {inputEditorMono} min-h-32"
            bind:value={importText}
            placeholder={m["shared.import_json_placeholder"]()}
            disabled={importBusy}></textarea>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button
              class={btnGhost}
              type="button"
              disabled={importBusy}
              onclick={() => applyImportText(importText)}
            >
              {importBusy ? m["shared.import_busy"]() : m["shared.import_apply"]()}
            </button>
            <input
              class="text-[0.85rem] file:cursor-pointer file:rounded-md file:border-0 file:bg-white-10 file:px-3 file:py-1.5 file:text-white-80"
              type="file"
              accept="application/json,.json"
              disabled={importBusy}
              onchange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file !== undefined) void applyImportFile(file);
              }}
            />
            {#if importedHeader !== null || importedData !== null}
              <button
                class="ml-auto text-[0.85rem] text-white-50 hover:text-white-70"
                type="button"
                onclick={clearImport}
              >
                {m["shared.import_clear"]()}
              </button>
            {/if}
          </div>
          {#if importErrors !== null}
            <p class="mt-2 text-[0.85rem] text-error">{importErrors}</p>
          {/if}
          {#if importWarnings !== null && importWarnings !== ""}
            <p class="mt-2 text-[0.85rem] text-amber-300">{importWarnings}</p>
          {/if}
          {#if importSummary !== null}
            <p class="mt-2 text-[0.85rem] text-success">{importSummary}</p>
          {/if}
        </details>

        <div class="text-center">
          <button class={btnPrimary} type="submit" disabled={idResult?.ok !== true || busy}>
            {m["shared.new_next"]()}
          </button>
        </div>
      </form>
    {/if}
  </GlassPanel>
{/snippet}
