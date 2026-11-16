<script lang="ts">
  import { entryLabel, findChartByHashes } from "@brightmeows/bms/editor";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import { onDestroy, onMount } from "svelte";

  import { btnGhost, inputEditorBase } from "#lib/constants/ui-classes.js";
  import {
    loadChartSourceData,
    loadChartSources,
    type ChartSource,
  } from "#lib/data/api/bms-sources.js";
  import { SearchIndexClient } from "#lib/data/store/search-index-client.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { errorMessageOf } from "#lib/utils/infra/error.js";

  /** 段位谱面反查结果：表 id 与命中条目。 */
  interface LookupHit {
    tableId: string;
    entry: Record<string, unknown>;
  }

  /**
   * 段位谱面反查：当前表直接命中；镜像走搜索索引；共享表由用户选一张后
   * 拉 data.json 查哈希。只展示元数据，不写入任何表。
   */
  interface Props {
    chart: { md5: string; sha256: string };
    entries: readonly Record<string, unknown>[];
    onclose: () => void;
  }

  let { chart, entries, onclose }: Props = $props();

  const indexClient = new SearchIndexClient();
  let mirrorPending = $state(false);
  let mirrorLoading = $state(false);
  let mirrorSearched = $state(false);
  let mirrorError = $state<string | null>(null);
  let mirrorResults = $state<LookupHit[]>([]);
  let sources = $state<ChartSource[]>([]);
  let sourcesLoaded = $state(false);
  let sharedValue = $state("");
  let sharedLoading = $state(false);
  let sharedSearched = $state(false);
  let sharedError = $state<string | null>(null);
  let sharedResults = $state<LookupHit[]>([]);
  let mirrorRequest = 0;
  let sharedRequest = 0;

  const hasHash = $derived(chart.md5 !== "" || chart.sha256 !== "");
  const currentEntry = $derived(findChartByHashes(entries, chart));
  const sharedSources = $derived(sources.filter((source) => source.kind === "shared"));
  const hashKey = $derived(`${chart.md5}\u0000${chart.sha256}`);

  onMount(() => {
    indexClient.start();
    void loadSources();
  });

  onDestroy(() => {
    indexClient.dispose();
  });

  $effect(() => {
    void hashKey;
    mirrorRequest += 1;
    sharedRequest += 1;
    mirrorPending = false;
    mirrorLoading = false;
    mirrorSearched = false;
    mirrorError = null;
    mirrorResults = [];
    sharedLoading = false;
    sharedSearched = false;
    sharedError = null;
    sharedResults = [];
  });

  $effect(() => {
    void sharedValue;
    sharedRequest += 1;
    sharedLoading = false;
    sharedSearched = false;
    sharedError = null;
    sharedResults = [];
  });

  $effect(() => {
    if (!mirrorPending) return;
    if (indexClient.phase === "ready") {
      mirrorPending = false;
      void searchMirror();
    } else if (indexClient.phase === "error") {
      mirrorPending = false;
      mirrorError = indexClient.errorMessage ?? m["common.unknown_error"]();
    }
  });

  async function loadSources(): Promise<void> {
    sources = await loadChartSources();
    sourcesLoaded = true;
  }

  function hashOf(entry: Record<string, unknown>): string {
    const md5 = typeof entry.md5 === "string" ? entry.md5 : "";
    const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : "";
    return md5 !== "" ? md5 : sha256;
  }

  function describe(entry: Record<string, unknown>): string {
    const title = entryLabel(entry);
    const artist = typeof entry.artist === "string" ? entry.artist : "";
    if (title === "") return hashOf(entry).slice(0, 16);
    return artist === "" ? title : `${title} / ${artist}`;
  }

  async function searchMirror(): Promise<void> {
    if (!hasHash) {
      mirrorError = m["editor.course.lookup.no_hash"]();
      return;
    }
    if (indexClient.phase !== "ready") {
      mirrorPending = true;
      return;
    }
    const request = ++mirrorRequest;
    const hashes = { md5: chart.md5, sha256: chart.sha256 };
    mirrorLoading = true;
    mirrorSearched = true;
    mirrorError = null;
    mirrorResults = [];
    try {
      const queries = [hashes.md5, hashes.sha256].filter((hash) => hash !== "");
      const lists = await Promise.all(queries.map((query) => indexClient.search(query)));
      const byTable = new Map(
        lists.flat().map((candidate) => [candidate.tableId, candidate] as const)
      );
      const candidates = [...byTable.values()];
      if (request !== mirrorRequest) return;
      const hits: LookupHit[] = [];
      for (const candidate of candidates.slice(0, 5)) {
        if (request !== mirrorRequest) return;
        try {
          const data = await loadChartSourceData({
            kind: "mirror",
            id: candidate.tableId,
            label: candidate.tableId,
          });
          const entry = findChartByHashes(data.entries, hashes);
          if (entry !== null) hits.push({ tableId: candidate.tableId, entry });
        } catch {
          // 单张表读取失败不打断其他候选
        }
      }
      mirrorResults = hits;
    } catch (error) {
      if (request !== mirrorRequest) return;
      mirrorError = errorMessageOf(error, m["common.unknown_error"]());
    } finally {
      if (request === mirrorRequest) mirrorLoading = false;
    }
  }

  async function searchShared(): Promise<void> {
    if (!hasHash || sharedValue === "") return;
    const source = sharedSources.find((item) => item.id === sharedValue);
    if (source === undefined) return;
    const request = ++sharedRequest;
    const hashes = { md5: chart.md5, sha256: chart.sha256 };
    sharedLoading = true;
    sharedSearched = true;
    sharedError = null;
    sharedResults = [];
    try {
      const data = await loadChartSourceData(source);
      if (request !== sharedRequest) return;
      const entry = findChartByHashes(data.entries, hashes);
      sharedResults = entry === null ? [] : [{ tableId: source.id, entry }];
    } catch (error) {
      if (request !== sharedRequest) return;
      sharedError = errorMessageOf(error, m["common.unknown_error"]());
    } finally {
      if (request === sharedRequest) sharedLoading = false;
    }
  }
</script>

<div class="rounded-glass-sm border border-white-15 bg-black-20 p-2">
  <div class="mb-2 flex items-start justify-between gap-2">
    <div class="min-w-0">
      <div class="text-[0.9rem] font-medium text-white">{m["editor.course.lookup.title"]()}</div>
      <p class="mt-0.5 text-[0.78rem] text-white-50">{m["editor.course.lookup.hint"]()}</p>
    </div>
    <button
      class={btnGhost}
      type="button"
      aria-label={m["editor.course.lookup.close"]()}
      title={m["editor.course.lookup.close"]()}
      onclick={onclose}
    >
      <X class="size-4 shrink-0" aria-hidden="true" />
    </button>
  </div>

  <div class="flex flex-col gap-2">
    <div class="rounded-glass-sm border border-white-10 bg-black-10 p-2">
      <div class="text-[0.8rem] text-white-50">{m["editor.course.lookup.current"]()}</div>
      {#if currentEntry !== null}
        <div class="mt-1 text-[0.85rem] text-white-80">
          {describe(currentEntry)}
          <span class="ml-1.5 text-[0.75rem] text-success">
            {m["editor.course.lookup.current_found"]()}
          </span>
        </div>
      {:else}
        <div class="mt-1 text-[0.85rem] text-white-50">
          {m["editor.course.lookup.current_missing"]()}
        </div>
      {/if}
    </div>

    <div class="rounded-glass-sm border border-white-10 bg-black-10 p-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[0.8rem] text-white-50">{m["editor.course.lookup.mirror"]()}</span>
        <button
          class="{btnGhost} ml-auto"
          type="button"
          disabled={!hasHash || mirrorLoading || mirrorPending}
          onclick={() => void searchMirror()}
        >
          <Search class="size-4 shrink-0" aria-hidden="true" />
          {m["editor.course.lookup.mirror_search"]()}
        </button>
      </div>
      {#if mirrorLoading || mirrorPending}
        <p class="mt-1 text-[0.82rem] text-white-50">
          {indexClient.phase === "loading"
            ? m["editor.course.lookup.index_loading"]()
            : m["editor.course.lookup.loading"]()}
        </p>
      {:else if mirrorError !== null}
        <p class="mt-1 text-[0.82rem] text-error">
          {m["editor.course.lookup.failed"]({ detail: mirrorError })}
        </p>
      {:else if mirrorResults.length > 0}
        <ul class="mt-1 space-y-1">
          {#each mirrorResults as hit (hit.tableId)}
            <li class="text-[0.82rem] text-white-75">
              {describe(hit.entry)}
              <span class="ml-1 font-mono text-[0.72rem] text-white-40">{hit.tableId}</span>
            </li>
          {/each}
        </ul>
      {:else if mirrorSearched && mirrorResults.length === 0}
        <p class="mt-1 text-[0.82rem] text-white-50">{m["editor.course.lookup.empty"]()}</p>
      {/if}
    </div>

    <div class="rounded-glass-sm border border-white-10 bg-black-10 p-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[0.8rem] text-white-50">{m["editor.course.lookup.shared"]()}</span>
        <select
          class="{inputEditorBase} max-w-56 flex-1"
          bind:value={sharedValue}
          disabled={!sourcesLoaded || sharedSources.length === 0}
        >
          <option value=""
            >{sourcesLoaded
              ? m["editor.course.lookup.shared_select"]()
              : m["editor.course.lookup.loading"]()}</option
          >
          {#each sharedSources as source (source.id)}
            <option value={source.id}>{source.label}</option>
          {/each}
        </select>
        <button
          class={btnGhost}
          type="button"
          disabled={!hasHash || sharedValue === "" || sharedLoading}
          onclick={() => void searchShared()}
        >
          {m["editor.course.lookup.search"]()}
        </button>
      </div>
      {#if sharedLoading}
        <p class="mt-1 text-[0.82rem] text-white-50">{m["editor.course.lookup.loading"]()}</p>
      {:else if sharedError !== null}
        <p class="mt-1 text-[0.82rem] text-error">
          {m["editor.course.lookup.failed"]({ detail: sharedError })}
        </p>
      {:else if sharedResults.length > 0}
        <ul class="mt-1 space-y-1">
          {#each sharedResults as hit (hit.tableId)}
            <li class="text-[0.82rem] text-white-75">
              {describe(hit.entry)}
              <span class="ml-1 font-mono text-[0.72rem] text-white-40">{hit.tableId}</span>
            </li>
          {/each}
        </ul>
      {:else if sharedSearched && sharedResults.length === 0}
        <p class="mt-1 text-[0.82rem] text-white-50">{m["editor.course.lookup.empty"]()}</p>
      {/if}
    </div>

    {#if !hasHash}
      <p class="text-[0.82rem] text-amber-300">{m["editor.course.lookup.no_hash"]()}</p>
    {/if}
  </div>
</div>
