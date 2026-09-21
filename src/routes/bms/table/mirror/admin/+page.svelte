<script lang="ts">
  import { onMount } from "svelte";

  import PageShell from "$lib/components/layout/PageShell.svelte";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { SITE_ORIGIN } from "$lib/constants/site";
  import {
    adminAuthorize,
    adminDisable,
    adminMeta,
    adminReplace,
    adminRestore,
    fetchAdminOverview,
    type AdminOverview,
  } from "$lib/data/mirror-admin-api";
  import { loadMirrorTables } from "$lib/data/mirror-table-loader";
  import { ApiUnavailableError } from "$lib/data/mirror-user-api";
  import type { MirrorTableItem } from "$lib/types/bms";

  const tablesJsonPath = "/bms/table/mirror/tables.json";
  const baseRoute = "bms/table/mirror";
  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const fieldInput =
    "rounded-lg border border-white/20 bg-black/20 px-2 py-1.5 text-[0.9rem] text-white outline-none placeholder:text-white/40 focus:border-[#64b5f6]/60";

  let loading = $state(true);
  let gateError = $state<string | null>(null);
  let overview = $state<AdminOverview | null>(null);
  let tables = $state<MirrorTableItem[]>([]);
  let notice = $state<{ kind: "ok" | "error"; text: string } | null>(null);
  let busy = $state(false);

  let searchQuery = $state("");
  let selectedUrl = $state("");
  let disableNote = $state("");
  let replaceFrom = $state("");
  let replaceTo = $state("");
  let metaName = $state("");
  let metaSymbol = $state("");
  let metaTag1 = $state("");
  let metaTag2 = $state("");
  let metaTagOrder = $state("");

  let filteredTables = $derived(
    (searchQuery.trim() === ""
      ? tables
      : tables.filter((item) => {
          const needle = searchQuery.trim().toLowerCase();
          return (
            (item.name ?? "").toLowerCase().includes(needle) ||
            (item.dir_name ?? "").toLowerCase().includes(needle)
          );
        })
    ).slice(0, 200)
  );
  let selectedTable = $derived(tables.find((item) => item.url === selectedUrl) ?? null);

  /**
   * 清单加载器把 `url` 重写为站内镜像路径，`url_from` 才是原始源 URL；
   * 后台接口以源 URL 为键，提交前必须还原。
   */
  function sourceUrl(item: MirrorTableItem): string {
    return item.url_from ?? item.url;
  }

  async function load(): Promise<void> {
    loading = true;
    try {
      const [admin, list] = await Promise.all([
        fetchAdminOverview(),
        loadMirrorTables(tablesJsonPath, baseRoute),
      ]);
      overview = admin;
      tables = list;
      gateError = null;
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        gateError = `后台只在主站提供（当前是静态镜像站）：${SITE_ORIGIN}/bms/table/mirror/admin/`;
      } else {
        gateError = error instanceof Error ? error.message : "加载失败";
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });

  function requireSelected(): MirrorTableItem | null {
    if (selectedTable === null) {
      notice = { kind: "error", text: "请先在顶部选择一张表" };
      return null;
    }
    return selectedTable;
  }

  async function run(action: () => Promise<unknown>, okText: string): Promise<void> {
    busy = true;
    notice = null;
    try {
      await action();
      notice = { kind: "ok", text: okText };
      await load();
    } catch (error) {
      notice = { kind: "error", text: error instanceof Error ? error.message : "操作失败" };
    } finally {
      busy = false;
    }
  }

  function onAuthorize(action: "add" | "remove"): void {
    const table = requireSelected();
    if (table === null) return;
    const dirName = table.dir_name;
    void run(
      () => adminAuthorize(sourceUrl(table), dirName, action),
      action === "add" ? `已加入授权名单：${table.name}` : `已移出授权名单：${table.name}`
    );
  }

  function onDisable(action: "add" | "remove"): void {
    const table = requireSelected();
    if (table === null) return;
    void run(
      () => adminDisable(sourceUrl(table), table.dir_name, action, disableNote),
      action === "add" ? `已禁用：${table.name}` : `已启用：${table.name}`
    );
  }

  function onMeta(action: "set" | "clear"): void {
    const table = requireSelected();
    if (table === null) return;
    void run(
      () =>
        adminMeta(sourceUrl(table), action, {
          name: metaName,
          symbol: metaSymbol,
          tag1: metaTag1,
          tag2: metaTag2,
          tag_order: metaTagOrder,
        }),
      action === "set" ? `已保存元数据覆盖：${table.name}` : `已清除元数据覆盖：${table.name}`
    );
  }

  function onReplace(action: "add" | "remove", from: string, to?: string): void {
    void run(
      () => adminReplace(from, action === "add" ? to : undefined, action),
      action === "add" ? "已添加替换规则" : "已移除替换规则"
    );
  }

  function onRestore(dirName: string): void {
    void run(() => adminRestore(dirName), `已恢复：${dirName}`);
  }

  function formatTime(value: string | number): string {
    const at = typeof value === "number" ? value : Date.parse(value);
    if (!Number.isFinite(at)) return String(value);
    return new Date(at).toLocaleString();
  }
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title mb-2 text-center">镜像表后台</h1>
  <div class="mt-1 text-center text-[1.05rem] text-white/70">
    <a class="link-accent" href="/bms/table/mirror/">返回镜像列表</a>
  </div>
{/snippet}

{#snippet contentPane()}
  {#if loading}
    <div class="mt-6">
      <LoadingProgress variant="indeterminate" message="正在加载后台数据..." title="镜像表后台" />
    </div>
  {:else if gateError}
    <GlassPanel class="mt-4 text-[0.95rem] text-red-300">{gateError}</GlassPanel>
  {:else if overview}
    <div class="flex flex-col gap-4">
      {#if notice}
        <div
          class="text-center text-[0.9rem] {notice.kind === 'ok'
            ? 'text-[#4caf50]'
            : 'text-red-300'}"
        >
          {notice.text}
        </div>
      {/if}

      <GlassPanel>
        <h2 class="mb-2 text-[1.05rem] font-semibold text-white">选择表</h2>
        <div class="flex flex-wrap items-center gap-2">
          <input
            class={fieldInput}
            type="text"
            bind:value={searchQuery}
            placeholder="按名称或目录名过滤"
            aria-label="过滤清单"
          />
          <select class={fieldInput} bind:value={selectedUrl} aria-label="选择镜像表">
            <option value="">（选择一张表）</option>
            {#each filteredTables as item (item.url)}
              <option value={item.url}>{item.name}｜{item.dir_name}</option>
            {/each}
          </select>
        </div>
        {#if selectedTable}
          <div class="mt-2 text-[0.9rem] text-white/70">
            已选：<strong class="text-white">{selectedTable.name}</strong>
            {#if selectedTable.protected}<span class="ml-2 text-[#ffd54f]">已授权</span>{/if}
            {#if selectedTable.dir_name}<span class="ml-2 text-white/50"
                >{selectedTable.dir_name}</span
              >{/if}
          </div>
        {/if}
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            class={smallButton}
            type="button"
            disabled={busy}
            onclick={() => onAuthorize("add")}>加入授权名单</button
          >
          <button
            class={smallButton}
            type="button"
            disabled={busy}
            onclick={() => onAuthorize("remove")}>移出授权名单</button
          >
          <input
            class={fieldInput}
            type="text"
            bind:value={disableNote}
            placeholder="禁用原因（可选）"
            aria-label="禁用原因"
          />
          <button class={smallButton} type="button" disabled={busy} onclick={() => onDisable("add")}
            >禁用</button
          >
          <button
            class={smallButton}
            type="button"
            disabled={busy}
            onclick={() => onDisable("remove")}>启用</button
          >
        </div>
      </GlassPanel>

      <GlassPanel>
        <h2 class="mb-2 text-[1.05rem] font-semibold text-white">元数据覆盖（作用于已选表）</h2>
        <div class="flex flex-wrap items-center gap-2">
          <input
            class={fieldInput}
            type="text"
            bind:value={metaName}
            placeholder="名称"
            aria-label="名称"
          />
          <input
            class={fieldInput}
            type="text"
            bind:value={metaSymbol}
            placeholder="符号"
            aria-label="符号"
          />
          <input
            class={fieldInput}
            type="text"
            bind:value={metaTag1}
            placeholder="tag1"
            aria-label="tag1"
          />
          <input
            class={fieldInput}
            type="text"
            bind:value={metaTag2}
            placeholder="tag2"
            aria-label="tag2"
          />
          <input
            class={fieldInput}
            type="text"
            bind:value={metaTagOrder}
            placeholder="tag_order"
            aria-label="tag_order"
          />
          <button class={smallButton} type="button" disabled={busy} onclick={() => onMeta("set")}
            >保存覆盖</button
          >
          <button class={smallButton} type="button" disabled={busy} onclick={() => onMeta("clear")}
            >清除覆盖</button
          >
        </div>
        {#if overview.meta.length > 0}
          <ul class="mt-3 flex flex-col gap-1 text-[0.85rem] text-white/70">
            {#each overview.meta as item (item.url)}
              <li>
                {item.url}
                <span class="ml-2 text-white/50"
                  >{item.name ?? ""}
                  {item.symbol ?? ""}
                  {item.tag1 ?? ""}
                  {item.tag2 ?? ""}
                  {item.tag_order ?? ""}</span
                >
              </li>
            {/each}
          </ul>
        {/if}
      </GlassPanel>

      <GlassPanel>
        <h2 class="mb-2 text-[1.05rem] font-semibold text-white">替换规则</h2>
        <div class="flex flex-wrap items-center gap-2">
          <input
            class={fieldInput}
            type="text"
            bind:value={replaceFrom}
            placeholder="旧 URL（from）"
            aria-label="替换来源"
          />
          <input
            class={fieldInput}
            type="text"
            bind:value={replaceTo}
            placeholder="新 URL（to）"
            aria-label="替换目标"
          />
          <button
            class={smallButton}
            type="button"
            disabled={busy || replaceFrom.trim() === "" || replaceTo.trim() === ""}
            onclick={() => onReplace("add", replaceFrom.trim(), replaceTo.trim())}
          >
            添加规则
          </button>
        </div>
        {#if overview.replace.length > 0}
          <ul class="mt-3 flex flex-col gap-1 text-[0.85rem] text-white/70">
            {#each overview.replace as rule (rule.from)}
              <li class="flex flex-wrap items-center gap-2">
                <span>{rule.from} 替换为 {rule.to}</span>
                <button
                  class={smallButton}
                  type="button"
                  disabled={busy}
                  onclick={() => onReplace("remove", rule.from)}>移除</button
                >
              </li>
            {/each}
          </ul>
        {/if}
      </GlassPanel>

      <GlassPanel>
        <h2 class="mb-2 text-[1.05rem] font-semibold text-white">
          授权名单（{overview.counts.authorized}）与禁用表（{overview.counts.disabled}）
        </h2>
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <div class="mb-1 text-[0.9rem] text-white/60">授权名单</div>
            {#if overview.authorized.length === 0}
              <div class="text-[0.85rem] text-white/50">（空）</div>
            {:else}
              <ul class="flex flex-col gap-1 text-[0.85rem] text-white/70">
                {#each overview.authorized as item (item.url)}
                  <li>{item.dir_name ?? item.url}</li>
                {/each}
              </ul>
            {/if}
          </div>
          <div>
            <div class="mb-1 text-[0.9rem] text-white/60">禁用表</div>
            {#if overview.disabled.length === 0}
              <div class="text-[0.85rem] text-white/50">（空）</div>
            {:else}
              <ul class="flex flex-col gap-1 text-[0.85rem] text-white/70">
                {#each overview.disabled as item (item.url)}
                  <li>
                    {item.dir_name ?? item.url}{#if item.note}<span class="ml-2 text-white/45"
                        >（{item.note}）</span
                      >{/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </GlassPanel>

      <GlassPanel>
        <h2 class="mb-2 text-[1.05rem] font-semibold text-white">
          回收站（{overview.counts.trash}）
        </h2>
        {#if overview.trash.length === 0}
          <div class="text-[0.85rem] text-white/50">（空）</div>
        {:else}
          <ul class="flex flex-col gap-1 text-[0.85rem] text-white/70">
            {#each overview.trash as item (item.trash_prefix)}
              <li class="flex flex-wrap items-center gap-2">
                <span
                  >{item.dir_name}<span class="ml-2 text-white/45">{formatTime(item.uploaded)}</span
                  ></span
                >
                <button
                  class={smallButton}
                  type="button"
                  disabled={busy}
                  onclick={() => onRestore(item.dir_name)}>恢复</button
                >
              </li>
            {/each}
          </ul>
        {/if}
      </GlassPanel>

      <GlassPanel>
        <h2 class="mb-2 text-[1.05rem] font-semibold text-white">
          最近审计（{overview.audit.length}）
        </h2>
        {#if overview.audit.length === 0}
          <div class="text-[0.85rem] text-white/50">（空）</div>
        {:else}
          <ul class="flex flex-col gap-1 text-[0.85rem] text-white/70">
            {#each overview.audit as entry}
              <li>
                <span class="text-white/45">{formatTime(entry.at)}</span>
                <span class="ml-2 text-white/90">{entry.actor}</span>
                <span class="ml-2 text-[#64b5f6]">{entry.action}</span>
                <span class="ml-2">{entry.dir_name ?? entry.url ?? ""}</span>
                {#if entry.detail}<span class="ml-2 text-white/45">{entry.detail}</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </GlassPanel>
    </div>
  {/if}
{/snippet}
