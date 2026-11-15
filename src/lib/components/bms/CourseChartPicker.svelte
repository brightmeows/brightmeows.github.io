<script lang="ts">
  import { entryLabel, filterEntryIndices } from "@brightmeows/bms/editor";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { onMount } from "svelte";

  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import { btnGhost, inputEditorBase, inputEditorMono } from "#lib/constants/ui-classes.js";
  import {
    loadChartSourceData,
    loadChartSources,
    type ChartSource,
  } from "#lib/data/api/bms-sources.js";
  import { m } from "#lib/paraglide/messages.js";
  import { errorMessageOf } from "#lib/utils/infra/error.js";

  /** 段位谱面选择结果：只引用哈希与等级，不写条目表。 */
  export interface CourseChartRef {
    md5: string;
    sha256: string;
    levelText: string;
  }

  /**
   * 段位谱面 picker：当前表与跨表来源，多选后一次性返回。
   * 只读来源数据，不写条目表，也不改变来源表。
   */
  interface Props {
    entries: readonly Record<string, unknown>[];
    disabled?: boolean;
    onadd: (charts: CourseChartRef[]) => void;
    onclose: () => void;
  }

  let { entries, disabled = false, onadd, onclose }: Props = $props();

  const PICKER_LIMIT = 50;

  let sources = $state<ChartSource[]>([]);
  let sourcesLoaded = $state(false);
  let sourceQuery = $state("");
  let sourceValue = $state("current");
  let externalEntries = $state<Record<string, unknown>[]>([]);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let query = $state("");
  let selected = $state<Set<number>>(new Set());
  let sourceRequest = 0;

  const sourceMatches = $derived.by(() => {
    const needle = sourceQuery.trim().toLowerCase();
    const matches =
      needle === ""
        ? sources
        : sources.filter((source) => source.label.toLowerCase().includes(needle));
    return matches.slice(0, 30);
  });
  const mirrorSources = $derived(sourceMatches.filter((source) => source.kind === "mirror"));
  const sharedSources = $derived(sourceMatches.filter((source) => source.kind === "shared"));
  const activeEntries = $derived(sourceValue === "current" ? entries : externalEntries);
  const filteredAll = $derived(
    filterEntryIndices(activeEntries, { level: { kind: "all" }, query })
  );
  const filtered = $derived(filteredAll.slice(0, PICKER_LIMIT));
  const selectedCount = $derived(selected.size);

  onMount(() => {
    void loadSources();
  });

  async function loadSources(): Promise<void> {
    sources = await loadChartSources();
    sourcesLoaded = true;
  }

  async function handleSourceChange(): Promise<void> {
    const request = ++sourceRequest;
    selected = new Set();
    loadError = null;
    externalEntries = [];
    loading = false;
    if (sourceValue === "current") return;
    const [kind, ...rest] = sourceValue.split(":");
    const id = rest.join(":");
    const source = sources.find((item) => item.kind === kind && item.id === id);
    if (source === undefined) return;
    loading = true;
    try {
      const data = await loadChartSourceData(source);
      if (request !== sourceRequest) return;
      externalEntries = data.entries;
    } catch (error) {
      if (request !== sourceRequest) return;
      loadError = errorMessageOf(error, m["common.unknown_error"]());
    } finally {
      if (request === sourceRequest) loading = false;
    }
  }

  function toggle(index: number): void {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    selected = next;
  }

  function selectAll(): void {
    selected = new Set(filteredAll);
  }

  function clearSelection(): void {
    selected = new Set();
  }

  function chartOf(entry: Record<string, unknown>): CourseChartRef | null {
    const md5 = typeof entry.md5 === "string" ? entry.md5 : "";
    const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : "";
    if (md5 === "" && sha256 === "") return null;
    return {
      md5,
      sha256,
      levelText: typeof entry.level === "string" ? entry.level : "",
    };
  }

  function addSelected(): void {
    const charts: CourseChartRef[] = [];
    for (const index of selected) {
      const entry = activeEntries[index];
      if (entry === undefined) continue;
      const chart = chartOf(entry);
      if (chart !== null) charts.push(chart);
    }
    if (charts.length === 0) return;
    onadd(charts);
    selected = new Set();
    onclose();
  }

  function labelOf(entry: Record<string, unknown>): string {
    const label = entryLabel(entry);
    if (label !== "") return label;
    const hash = typeof entry.md5 === "string" ? entry.md5 : entry.sha256;
    return typeof hash === "string" && hash !== ""
      ? hash.slice(0, 16)
      : m["editor.entry.unnamed"]();
  }
</script>

<div class="rounded-glass-sm border border-accent/40 bg-accent/10 p-2">
  <div class="mb-2 flex flex-wrap items-center gap-2">
    <label class="flex min-w-48 flex-1 items-center gap-2 text-[0.85rem] text-white-60">
      <span class="shrink-0">{m["editor.course.picker.source"]()}</span>
      <select
        class="{inputEditorBase} min-w-0 flex-1"
        bind:value={sourceValue}
        {disabled}
        onchange={() => void handleSourceChange()}
      >
        <option value="current">{m["editor.course.picker.source_current"]()}</option>
        {#if mirrorSources.length > 0}
          <optgroup label={m["editor.course.picker.source_mirror"]()}>
            {#each mirrorSources as source (source.id)}
              <option value={`mirror:${source.id}`}>{source.label}</option>
            {/each}
          </optgroup>
        {/if}
        {#if sharedSources.length > 0}
          <optgroup label={m["editor.course.picker.source_shared"]()}>
            {#each sharedSources as source (source.id)}
              <option value={`shared:${source.id}`}>{source.label}</option>
            {/each}
          </optgroup>
        {/if}
      </select>
    </label>
    <button class={btnGhost} type="button" onclick={onclose}>
      <X class="size-4 shrink-0" aria-hidden="true" />
      {m["common.cancel"]()}
    </button>
  </div>

  <input
    class="{inputEditorMono} mb-2 w-full"
    type="text"
    bind:value={sourceQuery}
    placeholder={m["editor.entry.import.source_search"]()}
    {disabled}
  />

  <input
    class="{inputEditorMono} mb-2 w-full"
    type="text"
    bind:value={query}
    placeholder={m["editor.course.picker_search"]()}
    {disabled}
  />

  {#if loading}
    <p class="text-[0.85rem] text-white-50">{m["editor.entry.import.loading"]()}</p>
  {:else if loadError !== null}
    <p class="text-[0.85rem] text-error">
      {m["editor.entry.import.failed"]({ detail: loadError })}
    </p>
  {:else if !sourcesLoaded && sourceValue !== "current"}
    <p class="text-[0.85rem] text-white-50">{m["editor.entry.import.loading"]()}</p>
  {:else if filtered.length === 0}
    <p class="text-[0.85rem] text-white-50">{m["editor.course.picker_empty"]()}</p>
  {:else}
    <ul class="max-h-64 overflow-auto">
      {#each filtered as index (index)}
        {@const entry = activeEntries[index] ?? {}}
        <li class="border-b border-white-5 last:border-b-0">
          <label class="flex cursor-pointer items-center gap-2 py-1">
            <Checkbox
              size="sm"
              checked={selected.has(index)}
              {disabled}
              ariaLabel={labelOf(entry)}
              onchange={() => toggle(index)}
            />
            <span class="min-w-0 flex-1 truncate text-[0.85rem] text-white-80">
              {labelOf(entry)}
            </span>
            <span class="hidden font-mono text-[0.75rem] text-white-40 sm:inline">
              {typeof entry.md5 === "string" && entry.md5 !== ""
                ? entry.md5.slice(0, 12)
                : typeof entry.sha256 === "string"
                  ? entry.sha256.slice(0, 12)
                  : ""}
            </span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="mt-2 flex flex-wrap items-center gap-2">
    <button
      class={btnGhost}
      type="button"
      disabled={disabled || filtered.length === 0}
      onclick={selectAll}
    >
      {m["editor.course.picker.select_all"]()}
    </button>
    <button
      class={btnGhost}
      type="button"
      disabled={disabled || selectedCount === 0}
      onclick={clearSelection}
    >
      {m["editor.course.picker.clear"]()}
    </button>
    <button
      class="{btnGhost} ml-auto"
      type="button"
      disabled={disabled || selectedCount === 0}
      onclick={addSelected}
    >
      <Check class="size-4 shrink-0" aria-hidden="true" />
      {m["editor.course.picker.add_selected"]({ count: selectedCount })}
    </button>
  </div>
</div>
