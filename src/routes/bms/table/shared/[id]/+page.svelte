<script lang="ts">
  import { withLocalDataUrl, type SharedTableItem } from "@brightmeows/mirror/shared";
  import { sharedTablePath } from "@brightmeows/mirror/urls";
  import { onMount } from "svelte";

  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import BmsTablePage from "$lib/components/pages/BmsTablePage.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { r2SharedDataUrl, r2SharedHeaderUrl } from "$lib/constants/r2";
  import { SITE_ORIGIN, apiBase } from "$lib/constants/site";
  import { auth } from "$lib/data/auth-store.svelte";
  import { loadSharedTables, submitSharedDelete } from "$lib/data/shared-api";
  import { m } from "$lib/paraglide/messages.js";
  import { downloadJsonFile } from "$lib/utils/shared-table";

  // 表 id 直接来自路径参数：本页 URL 即共享表的导入地址（Worker 注入 meta）。
  const tableId = $derived(page.params.id ?? "");

  /**
   * 查看页是薄壳：渲染共享的 BmsTablePage，操作条按权限显隐——
   * 下载对所有访客开放（数据本就公开），编辑仅作者，删除为作者或 admin
   * （服务端权限不变，前端仅按角色显隐，与镜像口径一致）。
   */
  let item = $state<SharedTableItem | null>(null);
  let listLoaded = $state(false);
  let busy = $state(false);
  let notice = $state<{ kind: "ok" | "error"; text: string } | null>(null);
  let loginHref = $state("/api/auth/login");

  const unavailable = $derived(auth.status === "unavailable");
  const login = $derived(auth.user?.login ?? null);
  const isAdmin = $derived(auth.status === "ready" && auth.user?.role === "admin");
  const canEdit = $derived(item !== null && login !== null && login === item.author);
  const canDelete = $derived(canEdit || (item !== null && isAdmin));
  const editorHref = $derived(
    (unavailable ? SITE_ORIGIN : "") + `${sharedTablePath(tableId)}edit/`
  );

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

  async function handleDelete(): Promise<void> {
    if (item === null || busy) return;
    const label = item.name === "" ? item.id : item.name;
    if (!window.confirm(m["shared.delete_confirm"]({ name: label }))) return;
    busy = true;
    notice = null;
    try {
      await submitSharedDelete(item.id);
      await goto("/bms/table/shared/");
    } catch (error) {
      notice = {
        kind: "error",
        text: error instanceof Error ? error.message : m["shared.delete_failed"](),
      };
    } finally {
      busy = false;
    }
  }

  const barButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[0.9rem] whitespace-nowrap text-white/85 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

  onMount(() => {
    void auth.ensureLoaded();
    const returnTo = `${window.location.pathname}`;
    loginHref = `${apiBase()}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    void loadSharedTables()
      .then((items) => {
        item = items.find((entry) => entry.id === tableId) ?? null;
      })
      .catch(() => {
        // 清单读取失败只影响操作条（作者/管理员判定），查看本身不受影响
      })
      .finally(() => {
        listLoaded = true;
      });
  });
</script>

{#if tableId === ""}
  <div class="p-12 text-center">
    <EmptyState
      title={m["mirror.missing_param_title"]()}
      description={m["mirror.missing_param_desc"]()}
    />
  </div>
{:else}
  <BmsTablePage headerUrl={r2SharedHeaderUrl(tableId)}>
    {#snippet actions()}
      {#if item !== null}
        <span class="text-[0.95rem] text-white/60">
          {m["shared.author_label"]({ name: item.author })}
        </span>
      {/if}
      <button class={barButton} type="button" onclick={() => void download("header")}>
        {m["shared.download_header"]()}
      </button>
      <button class={barButton} type="button" onclick={() => void download("data")}>
        {m["shared.download_data"]()}
      </button>
      {#if auth.status === "ready" && login === null}
        <a class={barButton} href={loginHref}>{m["topbar.login"]()}</a>
      {/if}
      {#if canEdit}
        <a class={barButton} href={editorHref}>{m["shared.actions_edit"]()}</a>
      {/if}
      {#if canDelete}
        <button class={barButton} type="button" disabled={busy} onclick={() => void handleDelete()}>
          {m["shared.actions_delete"]()}
        </button>
      {/if}
      {#if notice}
        <span class="text-[0.9rem] {notice.kind === 'ok' ? 'text-[#4caf50]' : 'text-red-300'}">
          {notice.text}
        </span>
      {/if}
      {#if unavailable && listLoaded && item !== null}
        <span class="text-[0.85rem] text-white/50">{m["shared.edit_on_main_site"]()}</span>
      {/if}
    {/snippet}
  </BmsTablePage>
{/if}
