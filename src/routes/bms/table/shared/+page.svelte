<script lang="ts">
  import type { SharedTableItem } from "@brightmeows/mirror/shared";
  import { onMount } from "svelte";

  import { resolve } from "$app/paths";
  import SharedTablesSection from "$lib/components/bms/SharedTablesSection.svelte";
  import SharedTrashPanel from "$lib/components/bms/SharedTrashPanel.svelte";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { SITE_ORIGIN } from "$lib/constants/site";
  import { auth } from "$lib/data/auth-store.svelte";
  import { searchConverters } from "$lib/data/search-converters.svelte";
  import { loadSharedTables, submitSharedDelete } from "$lib/data/shared-api";
  import { m } from "$lib/paraglide/messages.js";
  import { buildSearchNeedles } from "$lib/utils/mirror-tables";
  import { filterMineOnly, filterSharedTables, groupSharedTables } from "$lib/utils/shared-table";

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

  const unavailable = $derived(auth.status === "unavailable");
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
  <p class="mt-2 text-center text-[1.1rem] text-white/70">{m["shared.subtitle"]()}</p>
  <div class="mt-4 text-center">
    <a
      class="cursor-pointer rounded-[25px] border-none bg-accent px-6 py-2.5 text-[1rem] font-semibold text-white no-underline transition-colors duration-300 ease-out hover:bg-accent-hover"
      href={resolve("/bms/table/shared/new", {})}
    >
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
          ? 'text-[#4caf50]'
          : 'text-red-300'}"
      >
        {actionNotice.text}
      </div>
    {/if}

    {#if unavailable}
      <GlassPanel class="text-[0.95rem] text-white/75">
        {m["mirror.api_unavailable_before"]()}
        <a
          class="link-accent"
          href={`${SITE_ORIGIN}/bms/table/shared/`}
          target="_blank"
          rel="noopener noreferrer">{m["mirror.api_unavailable_link"]()}</a
        >{m["mirror.api_unavailable_after"]()}
      </GlassPanel>
    {/if}

    <div class="flex flex-wrap items-center justify-center gap-3">
      <h2 class="section-title">{m["shared.all_tables"]()}</h2>
      {#if login !== null}
        <label
          class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 select-none {mineOnly
            ? 'border-[#ffd54f] bg-[#ffd54f]/20 text-[#ffd54f]'
            : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'}"
        >
          <Checkbox size="sm" checked={mineOnly} onchange={(v: boolean) => (mineOnly = v)} />
          {m["shared.mine_filter"]()}
        </label>
      {/if}
    </div>

    <div class="relative w-full">
      <input
        class="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30"
        type="text"
        placeholder={m["shared.search_placeholder"]()}
        bind:value={searchQuery}
        onfocus={searchConverters.ensureLoaded}
      />
      {#if searchQuery.trim().length > 0}
        <button
          class="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white/20 bg-white/10 p-0 text-[1.25rem] leading-none text-white transition-all duration-200 ease-in-out hover:bg-white/20"
          type="button"
          aria-label={m["common.clear_search"]()}
          onclick={() => (searchQuery = "")}
        >
          ×
        </button>
      {/if}
    </div>
    {#if showFilterRow}
      <div class="text-[0.95rem] text-white/60">
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
    <div class="mt-6 text-red-300">{m["common.load_failed_with_error"]({ error })}</div>
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
