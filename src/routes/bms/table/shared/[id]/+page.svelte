<script lang="ts">
  import { withLocalDataUrl, type SharedTableItem } from "@brightmeows/mirror/shared";
  import { sharedTablePath } from "@brightmeows/mirror/urls";
  import { onMount } from "svelte";

  import { page } from "$app/state";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import BmsTablePage from "$lib/components/pages/BmsTablePage.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { r2SharedDataUrl, r2SharedHeaderUrl } from "$lib/constants/r2";
  import { SITE_ORIGIN, apiBase, isStaticHost } from "$lib/constants/site";
  import { btnBar, btnGhostMd, btnPrimary, inputEditorBase } from "$lib/constants/ui-classes";
  import {
    deleteSharedTable,
    initialSharedEditState,
    loadSharedEdit,
    renameSharedTable,
    saveSharedEdit,
    sharedEditCanWrite,
    sharedEditConflictBaseline,
    validateNewTableId,
    type SharedEditDeps,
    type SharedEditState,
  } from "$lib/controllers/shared-edit";
  import { auth } from "$lib/data/auth-store.svelte";
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
  import { downloadJsonFile } from "$lib/utils/download";
  import { draftStorageKey, type TableEditPayload } from "$lib/utils/table-editor";

  /**
   * 共享表页面（查看与编辑合并）：查看态复用 BmsTablePage，编辑态由同地址的
   * ?edit=1 就地切换。加载回退链（登录/未找到/静态宿主）与保存流沿用
   * controllers/shared-edit；新表（id 可用但尚未创建）只在编辑态呈现，
   * 首次保存才创建，管理块（改 id、删除）进编辑态的概览区。
   */
  const tableId = $derived(page.params.id ?? "");
  const isEdit = $derived(page.url.searchParams.has("edit"));

  let s = $state<SharedEditState | null>(null);
  let bridge = $state(false);
  let loginHref = $state("/api/auth/login");
  let newIdInput = $state("");
  let busy = $state(false);
  let notice = $state<{ kind: "ok" | "error"; text: string } | null>(null);

  const login = $derived(auth.user?.login ?? null);
  const isAdmin = $derived(auth.status === "ready" && auth.user?.role === "admin");
  const canWrite = $derived(s !== null && sharedEditCanWrite(s, login));
  const canRename = $derived(s !== null && !s.isNew && canWrite);
  const canDelete = $derived(s !== null && !s.isNew && (canWrite || (s.item !== null && isAdmin)));
  const isNew = $derived(s?.isNew === true);

  /** 控制器依赖：页面传真实现（auth store 与 shared-api）。 */
  function deps(): SharedEditDeps {
    return {
      auth: {
        ensureLoaded: () => auth.ensureLoaded(),
        unavailable: () => auth.status === "unavailable",
        login: () => auth.user?.login ?? null,
      },
      findInList: async (cacheBust: boolean): Promise<SharedTableItem | null> => {
        const items = await loadSharedTables(undefined, { cacheBust });
        return items.find((entry) => entry.id === tableId) ?? null;
      },
      checkId: (id: string) => fetchSharedCheckId(id),
      takeSeed: () => sharedNewSeed.take(),
      create: (payload) => submitSharedCreate(payload),
      save: (payload) => submitSharedSave(payload),
    };
  }

  async function load(): Promise<void> {
    s = await loadSharedEdit(deps(), tableId);
  }

  async function handleSave(payload: TableEditPayload): Promise<string | undefined> {
    const result = await saveSharedEdit(s ?? initialSharedEditState(), deps(), login ?? "", {
      id: tableId,
      header: payload.header,
      data: payload.data,
    });
    s = result.state;
    return result.newBaseline;
  }

  async function conflictCheck(): Promise<string | undefined> {
    return sharedEditConflictBaseline(deps());
  }

  async function download(kind: "header" | "data"): Promise<void> {
    notice = null;
    try {
      const headerRes = await fetch(r2SharedHeaderUrl(tableId));
      if (!headerRes.ok) throw new Error(m["shared.download_failed"]());
      const header = (await headerRes.json()) as Record<string, unknown>;
      if (kind === "header") {
        downloadJsonFile("header.json", withLocalDataUrl(header));
        return;
      }
      const dataUrl =
        typeof header.data_url === "string" && header.data_url !== ""
          ? header.data_url
          : r2SharedDataUrl(tableId);
      const dataRes = await fetch(dataUrl);
      if (!dataRes.ok) throw new Error(m["shared.download_failed"]());
      downloadJsonFile("data.json", await dataRes.json());
    } catch (error) {
      notice = {
        kind: "error",
        text: error instanceof Error ? error.message : m["shared.download_failed"](),
      };
    }
  }

  async function doRename(): Promise<void> {
    if (busy || s === null || s.isNew) return;
    const result = validateNewTableId(newIdInput, tableId);
    if ("error" in result) {
      notice = {
        kind: "error",
        text: result.error === "same" ? m["shared.rename_same"]() : m["shared.rename_invalid"](),
      };
      return;
    }
    busy = true;
    notice = null;
    const outcome = await renameSharedTable({
      tableId,
      newId: result.id,
      confirm: (message) => window.confirm(message),
      rename: submitSharedRename,
    });
    if (outcome.ok) {
      window.location.assign(`${sharedTablePath(outcome.id)}?edit=1`);
      return;
    }
    if (!("canceled" in outcome)) {
      notice = { kind: "error", text: outcome.text };
    }
    busy = false;
  }

  async function doDelete(): Promise<void> {
    if (busy || s === null || s.isNew) return;
    const label = s.item?.name === undefined || s.item.name === "" ? tableId : s.item.name;
    busy = true;
    notice = null;
    const outcome = await deleteSharedTable({
      tableId,
      label,
      confirm: (message) => window.confirm(message),
      remove: submitSharedDelete,
    });
    if (outcome.ok) {
      window.location.assign("/bms/table/shared/");
      return;
    }
    if (!("canceled" in outcome)) {
      notice = { kind: "error", text: outcome.text };
    }
    busy = false;
  }

  onMount(() => {
    bridge = isStaticHost();
    const returnTo = window.location.pathname;
    loginHref = `${apiBase()}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    void load();
  });
</script>

{#if tableId === ""}
  <div class="p-12 text-center">
    <EmptyState
      title={m["mirror.missing_param_title"]()}
      description={m["mirror.missing_param_desc"]()}
    />
  </div>
{:else if isEdit && s === null}
  <PageShell panes={[loadingPane]} />
{:else if isEdit && s !== null && (s.phase === "login" || s.phase === "notfound" || s.phase === "error" || (bridge && s.isNew))}
  <PageShell panes={[messagePane]} />
{:else}
  <BmsTablePage
    source={{
      headerUrl: isNew ? null : r2SharedHeaderUrl(tableId),
      dataUrlFallback: isNew ? null : r2SharedDataUrl(tableId),
      draftKey: draftStorageKey("shared", tableId),
    }}
    publish={{
      onSave: bridge || s === null ? undefined : handleSave,
      conflictCheck: bridge ? undefined : conflictCheck,
      saveAsShared: isNew ? "none" : bridge ? "bridge" : "same-origin",
      siteOrigin: SITE_ORIGIN,
    }}
    capabilities={{
      mode: "shared",
      canWrite,
      createMode: isNew,
      initialBaselineUpdatedAt: s?.baseline,
      seed: s?.seed,
    }}
  >
    {#snippet actions()}
      {#if s?.item != null}
        <span class="text-[0.95rem] text-white/60">
          {m["shared.author_label"]({ name: s.item.author })}
        </span>
      {/if}
      {#if !isNew}
        <button class={btnBar} type="button" onclick={() => void download("header")}>
          {m["shared.download_header"]()}
        </button>
        <button class={btnBar} type="button" onclick={() => void download("data")}>
          {m["shared.download_data"]()}
        </button>
      {/if}
      {#if auth.status === "ready" && login === null}
        <a class={btnBar} href={loginHref}>{m["topbar.login"]()}</a>
      {/if}
      {#if notice}
        <span class="text-[0.9rem] {notice.kind === 'ok' ? 'text-[#4caf50]' : 'text-red-300'}">
          {notice.text}
        </span>
      {/if}
    {/snippet}

    {#snippet management()}
      {#if canRename || canDelete}
        <div class="flex flex-col gap-4">
          {#if canRename}
            <div class="rounded-lg border border-white/15 bg-black/20 p-3">
              <div class="mb-2 text-[0.9rem] text-white/70">{m["shared.rename_section"]()}</div>
              <div class="flex flex-wrap gap-2">
                <input
                  class="{inputEditorBase} min-w-50 flex-1"
                  type="text"
                  bind:value={newIdInput}
                  placeholder={m["shared.rename_placeholder"]({ id: tableId })}
                  disabled={busy}
                />
                <button
                  class={btnGhostMd}
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
                class="{btnGhostMd} text-red-200/80 hover:bg-red-400/20 hover:text-red-200"
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
  </BmsTablePage>
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
      {#if s?.phase === "login"}
        <p class="text-[1rem] text-white/75">{m["shared.login_required"]()}</p>
        <a class="{btnPrimary} mt-4 inline-block" href={loginHref}>{m["topbar.login"]()}</a>
      {:else if s?.phase === "notfound"}
        <p class="text-[1.05rem] text-red-300">{m["shared.not_found"]()}</p>
        <p class="mt-2 text-[0.9rem] text-white/60">{m["shared.not_found_hint"]()}</p>
        <a class="link-accent mt-3 inline-block" href="/bms/table/shared/">
          {m["shared.back_to_list"]()}
        </a>
      {:else if s?.phase === "error"}
        <p class="text-[1.05rem] text-red-300">
          {m["common.load_failed_with_error"]({
            error: s.loadError ?? m["common.unknown_error"](),
          })}
        </p>
        <button class="{btnGhostMd} mt-3" type="button" onclick={() => void load()}>
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
