<script lang="ts">
  import {
    filterMineOnly,
    filterSharedTables,
    groupSharedTables,
    sortSharedGroups,
    type SharedSortKey,
  } from "@brightmeows/bms/shared";
  import type { SharedTableItem } from "@brightmeows/mirror/shared";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import { onMount, tick } from "svelte";

  import type { PageData } from "./$types";

  import BmsTableList from "#lib/components/bms/BmsTableList.svelte";
  import SharedTablesSection from "#lib/components/bms/SharedTablesSection.svelte";
  import SharedTrashPanel from "#lib/components/bms/SharedTrashPanel.svelte";
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import { createConfirmDialog } from "#lib/components/ui/confirm-dialog.svelte.js";
  import ConfirmDialog from "#lib/components/ui/ConfirmDialog.svelte";
  import LoadingProgress from "#lib/components/ui/LoadingProgress.svelte";
  import {
    btnChip,
    btnChipOnWarning,
    btnGhostXs,
    btnInputClear,
    btnPrimaryLink,
  } from "#lib/constants/ui-classes.js";
  import { loadSharedTables, submitSharedDelete } from "#lib/data/api/shared-api.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
  import { searchConverters } from "#lib/data/store/search-converters.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { TocItem } from "#lib/types/ui.js";
  import { errorMessageOf } from "#lib/utils/infra/error.js";
  import { buildSearchNeedles } from "#lib/utils/mirror-tables.js";
  import { buildTocFromHeadings } from "#lib/utils/ui/toc.js";
  import { resolve } from "$app/paths";

  /**
   * 共享表（主体）与自托管表（SSG 枚举）的单页总览：共享表按作者分组、
   * 我的组置顶、“只看我的”筛选、搜索；创建入口在标题区；删除/恢复走主站 API。
   */
  const pageTitle = m["table.page.title"]();

  let tocItems = $state<TocItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let tables = $state<SharedTableItem[]>([]);
  let searchQuery = $state("");
  let mineOnly = $state(false);
  let sortKey = $state<SharedSortKey>("default");
  let deletingId = $state<string | null>(null);
  let actionNotice = $state<{ kind: "ok" | "error"; text: string } | null>(null);
  let trashPanel = $state<{ refresh: () => Promise<void> } | undefined>(undefined);

  const login = $derived(auth.user?.login ?? null);
  const isAdmin = $derived(auth.status === "ready" && auth.user?.role === "admin");

  let searchNeedles = $derived(buildSearchNeedles(searchQuery, searchConverters.list));
  let matched = $derived(filterSharedTables(tables, searchNeedles));
  let groups = $derived(
    sortSharedGroups(filterMineOnly(groupSharedTables(matched, login), mineOnly, login), sortKey)
  );

  /** 排序键选项：value 是 SharedSortKey，label 走三语消息。 */
  const sortOptions: { value: SharedSortKey; label: () => string }[] = [
    { value: "default", label: m["shared.sort.default"] },
    { value: "updated", label: m["shared.sort.updated"] },
    { value: "entries", label: m["shared.sort.entries"] },
    { value: "name", label: m["shared.sort.name"] },
  ];

  async function loadTables(cacheBust = false): Promise<void> {
    try {
      tables = await loadSharedTables(undefined, { cacheBust });
      error = null;
    } catch (e) {
      error = errorMessageOf(e, m["common.unknown_error"]());
    } finally {
      loading = false;
    }
  }

  const confirmDialog = createConfirmDialog();

  async function handleDelete(item: SharedTableItem): Promise<void> {
    const label = item.name === "" ? item.id : item.name;
    if (
      !(await confirmDialog.ask(m["shared.delete.confirm"]({ name: label }), { destructive: true }))
    ) {
      return;
    }
    deletingId = item.id;
    actionNotice = null;
    try {
      await submitSharedDelete(item.id);
      actionNotice = { kind: "ok", text: m["shared.delete.done"]({ name: label }) };
      await loadTables(true);
      await trashPanel?.refresh();
      await auth.refresh();
    } catch (e) {
      actionNotice = {
        kind: "error",
        text: errorMessageOf(e, m["shared.delete.failed"]()),
      };
    } finally {
      deletingId = null;
    }
  }

  const showFilterRow = $derived(searchQuery.trim().length > 0 || mineOnly);

  let { data }: { data: PageData } = $props();

  onMount(async () => {
    await tick();
    tocItems = buildTocFromHeadings({ minLevel: 2, maxLevel: 2 });
    void auth.ensureLoaded();
    void loadTables();
  });
</script>

<PageShell {tocItems} panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{pageTitle}</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white-70">{m["table.page.subtitle"]()}</p>
  <div class="mt-4 text-center">
    <a class={btnPrimaryLink} href={resolve("/bms/table/shared/new")}>
      {m["shared.create.button"]()}
    </a>
  </div>
  <p class="mt-2 text-center text-[0.85rem] text-white-50">
    <a
      class={btnGhostXs}
      href="https://github.com/brightmeows/bms-skills/blob/main/skills/bms-table/SKILL.md"
      target="_blank"
      rel="noopener noreferrer"
    >
      <BookOpen class="size-4 shrink-0" aria-hidden="true" />
      {m["table.page.reference"]()}
    </a>
  </p>
{/snippet}

{#snippet contentPane()}
  <section id="shared" class="flex flex-col gap-3">
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
      <h2 class="section-title">{m["shared.list.title"]()}</h2>
      {#if login !== null}
        <label class={mineOnly ? btnChipOnWarning : btnChip}>
          <Checkbox
            size="sm"
            ariaLabel={m["shared.mine.filter"]()}
            checked={mineOnly}
            onchange={(v: boolean) => (mineOnly = v)}
          />
          {m["shared.mine.filter"]()}
        </label>
      {/if}
    </div>

    <div class="relative w-full">
      <input
        class="w-full rounded-glass-md border border-white-20 bg-black-20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white-50 focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
        type="text"
        placeholder={m["shared.list.search_placeholder"]()}
        bind:value={searchQuery}
        onfocus={searchConverters.ensureLoaded}
      />
      {#if searchQuery.trim().length > 0}
        <button
          class={btnInputClear}
          type="button"
          aria-label={m["common.clear_search"]()}
          onclick={() => (searchQuery = "")}
        >
          ×
        </button>
      {/if}
    </div>
    {#if showFilterRow}
      <div class="text-[0.95rem] text-white-60">
        {m["common.matched"]({
          shown: groups.reduce((sum, group) => sum + group.items.length, 0),
          total: tables.length,
        })}
      </div>
    {/if}

    <div class="flex flex-wrap items-center justify-center gap-2">
      <span class="text-[0.85rem] text-white-50">{m["shared.sort.label"]()}</span>
      {#each sortOptions as option (option.value)}
        <button
          class="rounded-glass-sm border px-2 py-[0.35rem] text-[0.85rem] transition-colors duration-200 select-none {sortKey ===
          option.value
            ? 'border-accent/60 bg-accent/15 text-accent'
            : 'border-white-20 text-white-50 hover:border-white-40 hover:text-white-70'}"
          type="button"
          aria-pressed={sortKey === option.value}
          onclick={() => (sortKey = option.value)}
        >
          {option.label()}
        </button>
      {/each}
    </div>

    {#if loading}
      <div class="mt-6">
        <LoadingProgress
          variant="indeterminate"
          message={m["shared.list.loading"]()}
          title={pageTitle}
        />
      </div>
    {:else if error}
      <div class="message-error mt-6">{m["common.load_failed_with_error"]({ error })}</div>
    {:else}
      <SharedTablesSection
        {groups}
        {login}
        {isAdmin}
        {deletingId}
        emptyTitle={showFilterRow ? m["shared.list.no_match"]() : m["shared.list.empty_title"]()}
        emptyDescription={showFilterRow
          ? m["shared.list.no_match_desc"]()
          : m["shared.list.empty_desc"]()}
        ondelete={(item) => void handleDelete(item)}
      />
    {/if}
  </section>

  <section id="self-hosted" class="mt-8">
    <BmsTableList tables={data.tables} />
  </section>
{/snippet}

<ConfirmDialog dialog={confirmDialog} />
