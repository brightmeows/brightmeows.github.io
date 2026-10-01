<script lang="ts">
  import { type SharedTableItem, validateSharedId } from "@brightmeows/mirror/shared";
  import { sharedTablePath } from "@brightmeows/mirror/urls";
  import { onMount } from "svelte";

  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import TableEditorPage from "$lib/components/pages/TableEditorPage.svelte";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { r2SharedDataUrl, r2SharedHeaderUrl } from "$lib/constants/r2";
  import { SITE_ORIGIN, apiBase } from "$lib/constants/site";
  import { auth } from "$lib/data/auth-store.svelte";
  import { ApiUnavailableError } from "$lib/data/mirror-user-api";
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
  import { draftStorageKey, type TableEditPayload } from "$lib/utils/table-editor";
  import { formatTitle } from "$lib/utils/title";

  /**
   * 共享表编辑页：统一编辑器承载，作者可整包保存回 R2（保存前并发提示），
   * 非作者无需登录即可本地编辑（草稿、导出、另存共享）；静态宿主上保存走
   * “导出并跳主站”的桥接路径（跨源草稿不可随行），新表创建只在主站进行。
   */
  const tableId = $derived(page.params.id ?? "");

  type Phase = "loading" | "login" | "unavailable" | "notfound" | "error" | "ready";

  let phase = $state<Phase>("loading");
  let loadError = $state<string | null>(null);
  let isNew = $state(false);
  let item = $state<SharedTableItem | null>(null);
  let baseline = $state<string | undefined>(undefined);
  let seedData = $state<{ name: string; symbol: string } | undefined>(undefined);
  let bridge = $state(false);
  let loginHref = $state("/api/auth/login");
  let newIdInput = $state("");
  let busy = $state(false);
  let notice = $state<{ kind: "ok" | "error"; text: string } | null>(null);

  const login = $derived(auth.user?.login ?? null);
  const isAdmin = $derived(auth.status === "ready" && auth.user?.role === "admin");
  const canWrite = $derived(
    isNew ? login !== null : item !== null && login !== null && login === item.author
  );
  const canRename = $derived(!isNew && canWrite);
  const canDelete = $derived(!isNew && (canWrite || (item !== null && isAdmin)));
  const viewerHref = $derived(sharedTablePath(tableId));

  async function findInList(cacheBust: boolean): Promise<SharedTableItem | null> {
    const items = await loadSharedTables(undefined, { cacheBust });
    return items.find((entry) => entry.id === tableId) ?? null;
  }

  async function load(): Promise<void> {
    phase = "loading";
    loadError = null;
    notice = null;
    await auth.ensureLoaded();

    // 静态宿主或主站 API 不可用：只依赖本站共享清单做本地编辑（不再查 id）
    if (auth.status === "unavailable") {
      try {
        const found = await findInList(false);
        if (found === null) {
          phase = "notfound";
          return;
        }
        item = found;
        baseline = found.updated_at;
        phase = "ready";
      } catch (error) {
        loadError = error instanceof Error ? error.message : m["common.unknown_error"]();
        phase = "error";
      }
      return;
    }

    try {
      if (login === null) {
        const found = await findInList(false);
        if (found === null) {
          // 未登录且清单里没有：可能是待创建的新表，先引导登录
          phase = "login";
          return;
        }
        item = found;
        baseline = found.updated_at;
        phase = "ready";
        return;
      }

      const check = await fetchSharedCheckId(tableId);
      if (check.available) {
        isNew = true;
        seedData = sharedNewSeed.take();
        phase = "ready";
        return;
      }
      const found = await findInList(false);
      if (found === null) {
        phase = "notfound";
        return;
      }
      item = found;
      baseline = found.updated_at;
      phase = "ready";
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        try {
          const found = await findInList(false);
          if (found === null) {
            phase = "notfound";
            return;
          }
          item = found;
          baseline = found.updated_at;
          phase = "ready";
        } catch (fallbackError) {
          loadError =
            fallbackError instanceof Error ? fallbackError.message : m["common.unknown_error"]();
          phase = "error";
        }
        return;
      }
      loadError = error instanceof Error ? error.message : m["common.unknown_error"]();
      phase = "error";
    }
  }

  async function handleSave(payload: TableEditPayload): Promise<string | undefined> {
    if (isNew) {
      const result = await submitSharedCreate({
        id: tableId,
        header: payload.header,
        data: payload.data,
      });
      isNew = false;
      item = {
        id: result.id,
        name: typeof payload.header.name === "string" ? payload.header.name : result.id,
        symbol: typeof payload.header.symbol === "string" ? payload.header.symbol : undefined,
        author: login ?? "",
        created_at: "",
        updated_at: "",
        entries: result.entries,
        url: viewerHref,
      };
      // 创建接口不返回 updated_at，拉一次清单作并发基线
      const found = await findInList(true);
      const next = found?.updated_at;
      baseline = next;
      return next;
    }
    const result = await submitSharedSave({
      id: tableId,
      header: payload.header,
      data: payload.data,
    });
    const next = result.updated_at !== "" ? result.updated_at : undefined;
    baseline = next;
    return next;
  }

  async function conflictCheck(): Promise<string | undefined> {
    const found = await findInList(true);
    return found?.updated_at;
  }

  async function doRename(): Promise<void> {
    if (busy || isNew) return;
    const result = validateRename(newIdInput);
    if (result === null) return;
    if (result.id === tableId) {
      notice = { kind: "error", text: m["shared.rename_same"]() };
      return;
    }
    if (!window.confirm(m["shared.rename_confirm"]({ from: tableId, to: result.id }))) return;
    busy = true;
    notice = null;
    try {
      await submitSharedRename(tableId, result.id);
      window.location.assign(`${sharedTablePath(result.id)}edit/`);
    } catch (error) {
      notice = {
        kind: "error",
        text: error instanceof Error ? error.message : m["shared.rename_failed"](),
      };
      busy = false;
    }
  }

  function validateRename(raw: string): { id: string } | null {
    // 与新建页共用同一套 id 规则（NFC 归一、字符集、保留词）
    const result = validateSharedId(raw);
    if (!result.ok) {
      notice = { kind: "error", text: m["shared.rename_invalid"]() };
      return null;
    }
    return { id: result.id };
  }

  async function doDelete(): Promise<void> {
    if (busy || isNew) return;
    const label = item?.name === undefined || item.name === "" ? tableId : item.name;
    if (!window.confirm(m["shared.delete_confirm"]({ name: label }))) return;
    busy = true;
    notice = null;
    try {
      await submitSharedDelete(tableId);
      await goto("/bms/table/shared/");
    } catch (error) {
      notice = {
        kind: "error",
        text: error instanceof Error ? error.message : m["shared.delete_failed"](),
      };
      busy = false;
    }
  }

  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const primaryButton =
    "cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";

  onMount(() => {
    bridge = apiBase() !== "";
    const returnTo = `${window.location.pathname}`;
    loginHref = `${apiBase()}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    void load();
  });
</script>

<svelte:head>
  <title>{formatTitle(isNew ? m["shared.new_title"]() : tableId)}</title>
</svelte:head>

{#if phase === "loading"}
  <PageShell panes={[loadingPane]} />
{:else if phase === "login"}
  <PageShell panes={[messagePane]} />
{:else if phase === "notfound"}
  <PageShell panes={[messagePane]} />
{:else if phase === "error"}
  <PageShell panes={[messagePane]} />
{:else if bridge && isNew}
  <PageShell panes={[messagePane]} />
{:else}
  <TableEditorPage
    headerUrl={isNew ? null : r2SharedHeaderUrl(tableId)}
    dataUrlFallback={isNew ? null : r2SharedDataUrl(tableId)}
    draftKey={draftStorageKey("shared", tableId)}
    viewerHref={isNew ? null : viewerHref}
    mode="shared"
    {canWrite}
    createMode={isNew}
    initialBaselineUpdatedAt={baseline}
    seed={seedData}
    onSave={bridge ? undefined : handleSave}
    saveAsShared={isNew ? "none" : bridge ? "bridge" : "same-origin"}
    siteOrigin={SITE_ORIGIN}
    conflictCheck={bridge ? undefined : conflictCheck}
  >
    {#snippet actions()}
      {#if item !== null}
        <span class="text-[0.95rem] text-white/60">
          {m["shared.author_label"]({ name: item.author })}
        </span>
      {/if}
      {#if notice !== null}
        <span class="text-[0.9rem] {notice.kind === 'ok' ? 'text-[#4caf50]' : 'text-red-300'}">
          {notice.text}
        </span>
      {/if}
    {/snippet}

    {#snippet banner()}
      {#if bridge}
        <div
          class="rounded-lg border border-[#64b5f6]/40 bg-[#64b5f6]/10 px-3 py-2 text-[0.9rem] text-[#90caf9]"
        >
          {m["editor.bridge_hint"]()}
        </div>
      {:else if !canWrite}
        <div
          class="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-[0.9rem] text-white/65"
        >
          {m["editor.shared_local_hint"]()}
        </div>
      {/if}
    {/snippet}

    {#snippet footer()}
      {#if canRename || canDelete}
        <div class="flex flex-col gap-4">
          {#if canRename}
            <div class="rounded-lg border border-white/15 bg-black/20 p-3">
              <div class="mb-2 text-[0.9rem] text-white/70">{m["shared.rename_section"]()}</div>
              <div class="flex flex-wrap gap-2">
                <input
                  class="min-w-50 flex-1 rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono text-[0.9rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60 focus:ring-1 focus:ring-[#64b5f6]/30 disabled:opacity-60"
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
          {#if canDelete}
            <div class="text-center">
              <button
                class="{smallButton} text-red-200/80 hover:bg-red-400/20 hover:text-red-200"
                type="button"
                disabled={busy}
                onclick={() => void doDelete()}
              >
                {m["shared.actions_delete"]()}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    {/snippet}
  </TableEditorPage>
{/if}

{#snippet loadingPane()}
  <GlassPanel>
    <LoadingProgress
      variant="indeterminate"
      message={m["shared.editor_loading"]()}
      title={m["shared.new_title"]()}
    />
  </GlassPanel>
{/snippet}

{#snippet messagePane()}
  <GlassPanel>
    <div class="py-6 text-center">
      {#if phase === "login"}
        <p class="text-[1rem] text-white/75">{m["shared.login_required"]()}</p>
        <a class="{primaryButton} mt-4 inline-block" href={loginHref}>{m["topbar.login"]()}</a>
      {:else if phase === "notfound"}
        <p class="text-[1.05rem] text-red-300">{m["shared.not_found"]()}</p>
        <p class="mt-2 text-[0.9rem] text-white/60">{m["shared.not_found_hint"]()}</p>
        <a class="link-accent mt-3 inline-block" href="/bms/table/shared/">
          {m["shared.back_to_list"]()}
        </a>
      {:else if phase === "error"}
        <p class="text-[1.05rem] text-red-300">
          {m["common.load_failed_with_error"]({ error: loadError ?? m["common.unknown_error"]() })}
        </p>
        <button class="{smallButton} mt-3" type="button" onclick={() => void load()}>
          {m["common.reload"]()}
        </button>
      {:else}
        <p class="text-[1rem] text-white/75">{m["editor.bridge_new_hint"]()}</p>
        <a
          class="link-accent mt-3 inline-block"
          href={`${SITE_ORIGIN}/bms/table/shared/new/`}
          target="_blank"
          rel="noopener noreferrer">{m["editor.bridge_new_link"]()}</a
        >
      {/if}
    </div>
  </GlassPanel>
{/snippet}
