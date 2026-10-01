<script lang="ts">
  import type { SharedTableItem } from "@brightmeows/mirror/shared";
  import { sharedTablePath } from "@brightmeows/mirror/urls";
  import { onMount } from "svelte";

  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import TableEditorPage from "$lib/components/pages/TableEditorPage.svelte";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { r2SharedDataUrl, r2SharedHeaderUrl } from "$lib/constants/r2";
  import { SITE_ORIGIN, apiBase, isStaticHost } from "$lib/constants/site";
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
  import { draftStorageKey, type TableEditPayload } from "$lib/utils/table-editor";
  import { formatTitle } from "$lib/utils/title";

  /**
   * 共享表编辑页：统一编辑器承载，作者可整包保存回 R2（保存前并发提示），
   * 非作者无需登录即可本地编辑（草稿、导出、另存共享）；静态宿主上保存走
   * “导出并跳主站”的桥接路径（跨源草稿不可随行），新表创建只在主站进行。
   * 加载回退链与保存流在 controllers/shared-edit（可单测），本页只持状态、
   * 绑定视图并处理 confirm 与导航。
   */
  const tableId = $derived(page.params.id ?? "");

  // 编排状态（整体替换更新）；页面私有的交互状态就地持有
  let s = $state<SharedEditState>(initialSharedEditState());
  let bridge = $state(false);
  let loginHref = $state("/api/auth/login");
  let newIdInput = $state("");
  let busy = $state(false);
  let notice = $state<{ kind: "ok" | "error"; text: string } | null>(null);

  const login = $derived(auth.user?.login ?? null);
  const isAdmin = $derived(auth.status === "ready" && auth.user?.role === "admin");
  const canWrite = $derived(sharedEditCanWrite(s, login));
  const canRename = $derived(!s.isNew && canWrite);
  const canDelete = $derived(!s.isNew && (canWrite || (s.item !== null && isAdmin)));
  const viewerHref = $derived(sharedTablePath(tableId));

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
    notice = null;
    s = await loadSharedEdit(deps(), tableId);
  }

  async function handleSave(payload: TableEditPayload): Promise<string | undefined> {
    const result = await saveSharedEdit(s, deps(), login ?? "", {
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

  async function doRename(): Promise<void> {
    if (busy || s.isNew) return;
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
      window.location.assign(`${sharedTablePath(outcome.id)}edit/`);
      return;
    }
    if (!("canceled" in outcome)) {
      notice = { kind: "error", text: outcome.text };
    }
    busy = false;
  }

  async function doDelete(): Promise<void> {
    if (busy || s.isNew) return;
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
      await goto("/bms/table/shared/");
      return;
    }
    if (!("canceled" in outcome)) {
      notice = { kind: "error", text: outcome.text };
    }
    busy = false;
  }

  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const primaryButton =
    "cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white transition-colors duration-300 ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";

  onMount(() => {
    bridge = isStaticHost();
    const returnTo = `${window.location.pathname}`;
    loginHref = `${apiBase()}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    void load();
  });
</script>

<svelte:head>
  <title>{formatTitle(s.isNew ? m["shared.new_title"]() : tableId)}</title>
</svelte:head>

{#if s.phase === "loading"}
  <PageShell panes={[loadingPane]} />
{:else if s.phase === "login"}
  <PageShell panes={[messagePane]} />
{:else if s.phase === "notfound"}
  <PageShell panes={[messagePane]} />
{:else if s.phase === "error"}
  <PageShell panes={[messagePane]} />
{:else if bridge && s.isNew}
  <PageShell panes={[messagePane]} />
{:else}
  <TableEditorPage
    source={{
      headerUrl: s.isNew ? null : r2SharedHeaderUrl(tableId),
      dataUrlFallback: s.isNew ? null : r2SharedDataUrl(tableId),
      draftKey: draftStorageKey("shared", tableId),
      viewerHref: s.isNew ? null : viewerHref,
    }}
    capabilities={{
      mode: "shared",
      canWrite,
      createMode: s.isNew,
      initialBaselineUpdatedAt: s.baseline,
      seed: s.seed,
    }}
    publish={{
      onSave: bridge ? undefined : handleSave,
      saveAsShared: s.isNew ? "none" : bridge ? "bridge" : "same-origin",
      siteOrigin: SITE_ORIGIN,
      conflictCheck: bridge ? undefined : conflictCheck,
    }}
  >
    {#snippet actions()}
      {#if s.item !== null}
        <span class="text-[0.95rem] text-white/60">
          {m["shared.author_label"]({ name: s.item.author })}
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
      {#if s.phase === "login"}
        <p class="text-[1rem] text-white/75">{m["shared.login_required"]()}</p>
        <a class="{primaryButton} mt-4 inline-block" href={loginHref}>{m["topbar.login"]()}</a>
      {:else if s.phase === "notfound"}
        <p class="text-[1.05rem] text-red-300">{m["shared.not_found"]()}</p>
        <p class="mt-2 text-[0.9rem] text-white/60">{m["shared.not_found_hint"]()}</p>
        <a class="link-accent mt-3 inline-block" href="/bms/table/shared/">
          {m["shared.back_to_list"]()}
        </a>
      {:else if s.phase === "error"}
        <p class="text-[1.05rem] text-red-300">
          {m["common.load_failed_with_error"]({
            error: s.loadError ?? m["common.unknown_error"](),
          })}
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
