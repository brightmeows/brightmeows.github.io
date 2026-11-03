<script lang="ts">
  import { filterMineOnly, filterSharedTables, groupSharedTables } from "@brightmeows/bms/shared";
  import type { SharedTableItem } from "@brightmeows/mirror/shared";
  import { onMount } from "svelte";

  import SharedTablesSection from "#lib/components/bms/SharedTablesSection.svelte";
  import SharedTrashPanel from "#lib/components/bms/SharedTrashPanel.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import { btnPrimaryLink } from "#lib/constants/ui-classes.js";
  import { loadSharedTables, submitSharedDelete } from "#lib/data/api/shared-api.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
  import { searchConverters } from "#lib/data/store/search-converters.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { buildSearchNeedles } from "#lib/utils/mirror-tables.js";
  import { resolve } from "$app/paths";

  /**
   * 共享表列表：按作者分组、我的组置顶、“只看我的”筛选、搜索；
   * 创建入口在页首（登录引导在新建页），删除/恢复走主站 API。
   */
  const pageTitle = m["shared.page_title"]();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let tables = $state<SharedTableItem[]>([]);
  let searchQuery = $state("");
  let mineOnly = $state(false);
  let deletingId = $state<string | null>(null);
  let actionNotice = $state<{ kind: "ok" | "error"; text: string } | null>(null);
  let trashPanel = $state<{ refresh: () => Promise<void> } | undefined>(undefined);

  const login = $derived(auth.user?.login ?? null);
  const isAdmin = $derived(auth.status === "ready" && auth.user?.role === "admin");

  let searchNeedles = $derived(buildSearchNeedles(searchQuery, searchConverters.list));
  let matched = $derived(filterSharedTables(tables, searchNeedles));
  let groups = $derived(filterMineOnly(groupSharedTables(matched, login), mineOnly, login));

  async function loadTables(cacheBust = false): Promise<void> {
    try {
      tables = await loadSharedTables(undefined, { cacheBust });
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : m["common.unknown_error"]();
    } finally {
      loading = false;
    }
  }

  async function handleDelete(item: SharedTableItem): Promise<void> {
    const label = item.name === "" ? item.id : item.name;
    if (!window.confirm(m["shared.delete_confirm"]({ name: label }))) return;
    deletingId = item.id;
    actionNotice = null;
    try {
      await submitSharedDelete(item.id);
      actionNotice = { kind: "ok", text: m["shared.deleted"]({ name: label }) };
      await loadTables(true);
      await trashPanel?.refresh();
      await auth.refresh();
    } catch (e) {
      actionNotice = {
        kind: "error",
        text: e instanceof Error ? e.message : m["shared.delete_failed"](),
      };
    } finally {
      deletingId = null;
    }
  }

  const showFilterRow = $derived(searchQuery.trim().length > 0 || mineOnly);

  onMount(() => {
    void auth.ensureLoaded();
    void loadTables();
  });
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{pageTitle}</h1>
  <p class="mt-2 text-center text-[1.1rem] text-text-secondary">{m["shared.subtitle"]()}</p>
  <div class="mt-4 text-center">
    <a class={btnPrimaryLink} href={resolve("/bms/table/shared/new")}>
      {m["shared.create_button"]()}
    </a>
  </div>
{/snippet}

{#snippet contentPane()}
  <div class="flex flex-col gap-3">
    <SharedTrashPanel bind:this={trashPanel} onchanged={() => void loadTables(true)} />

    {#if actionNotice}
      <div
        class="text-center text-[0.9rem] {actionNotice.kind === 'ok'
          ? 'text-success'
          : 'text-error'}"
      >
        {actionNotice.text}
      </div>
    {/if}

    <div class="flex flex-wrap items-center justify-center gap-3">
      <h2 class="section-title">{m["shared.all_tables"]()}</h2>
      {#if login !== null}
        <label
          class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 select-none {mineOnly
            ? 'border-warning bg-warning/20 text-warning'
            : 'border-border-control text-text-secondary hover:border-border-strong hover:text-text-secondary'}"
        >
          <Checkbox
            size="sm"
            ariaLabel={m["shared.mine_filter"]()}
            checked={mineOnly}
            onchange={(v: boolean) => (mineOnly = v)}
          />
          {m["shared.mine_filter"]()}
        </label>
      {/if}
    </div>

    <div class="relative w-full">
      <input
        class="w-full rounded-xl border border-border-control bg-canvas px-4 py-3 pr-12 text-text outline-none placeholder:text-text-secondary focus:border-focus focus:ring-2 focus:ring-focus"
        type="text"
        placeholder={m["shared.search_placeholder"]()}
        bind:value={searchQuery}
        onfocus={searchConverters.ensureLoaded}
      />
      {#if searchQuery.trim().length > 0}
        <button
          class="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-border-control bg-surface p-0 text-[1.25rem] leading-none text-text transition-all duration-200 ease-in-out hover:bg-surface-strong"
          type="button"
          aria-label={m["common.clear_search"]()}
          onclick={() => (searchQuery = "")}
        >
          ×
        </button>
      {/if}
    </div>
    {#if showFilterRow}
      <div class="text-[0.95rem] text-text-secondary">
        {m["common.matched"]({
          shown: groups.reduce((sum, group) => sum + group.items.length, 0),
          total: tables.length,
        })}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="mt-6">
      <LoadingProgress variant="indeterminate" message={m["shared.loading"]()} title={pageTitle} />
    </div>
  {:else if error}
    <div class="mt-6 text-error">{m["common.load_failed_with_error"]({ error })}</div>
  {:else}
    <SharedTablesSection
      {groups}
      {login}
      {isAdmin}
      {deletingId}
      emptyTitle={showFilterRow ? m["shared.no_match"]() : m["shared.empty_title"]()}
      emptyDescription={showFilterRow ? m["shared.no_match_desc"]() : m["shared.empty_desc"]()}
      ondelete={(item) => void handleDelete(item)}
    />
  {/if}
{/snippet}
