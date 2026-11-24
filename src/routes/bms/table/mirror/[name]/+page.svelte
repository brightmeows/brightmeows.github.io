<script lang="ts">
  import { draftStorageKey } from "@brightmeows/bms/editor";
  import type { MirrorTableHealth } from "@brightmeows/mirror/types";
  import { onMount } from "svelte";

  import BmsTablePage from "#lib/components/pages/BmsTablePage.svelte";
  import EmptyState from "#lib/components/ui/EmptyState.svelte";
  import { r2TableDataUrl, r2TableHeaderUrl } from "#lib/constants/r2.js";
  import { loadMirrorTables } from "#lib/data/api/mirror-table-loader.js";
  import { m } from "#lib/paraglide/messages.js";
  import { readMirrorTableMeta, staleNoticeText } from "#lib/utils/mirror-tables.js";
  import { page } from "$app/state";

  // 表 ID 直接来自路径参数：本页 URL 与镜像站导入地址同形，页面对外展示当前地址
  // 作为可导入链接（BmsTablePage 统一从地址栏取）；编辑态是同地址的 ?edit=1。
  const tableId = $derived(page.params.name ?? "");

  // 单表页由 Worker 注入健康元数据；客户端从搜索页跳转时没有注入，
  // 回退拉一次清单，避免 stale 提示在站内导航时消失。
  let health = $state<MirrorTableHealth | null>(null);
  const healthNotice = $derived(health?.status === "stale" ? staleNoticeText(health) : undefined);

  onMount(() => {
    const injected = readMirrorTableMeta();
    if (injected !== null) {
      health = injected;
      return;
    }
    void loadMirrorTables("/bms/table/mirror/tables.json", "bms/table/mirror")
      .then((tables) => {
        const item = tables.find((entry) => entry.dir_name === tableId);
        if (item?.status === "stale") {
          health = {
            status: item.status,
            ...(item.last_success === undefined ? {} : { last_success: item.last_success }),
            ...(item.reason === undefined ? {} : { reason: item.reason }),
          };
        }
      })
      .catch(() => {
        // 清单不可用时静默：stale 提示是增量信息，不阻塞表页
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
  <BmsTablePage
    source={{
      headerUrl: r2TableHeaderUrl(tableId),
      dataUrlFallback: r2TableDataUrl(tableId),
      draftKey: draftStorageKey("mirror", tableId),
    }}
    publish={{ saveAsShared: "same-origin" }}
    capabilities={{ kind: "mirror" }}
    disclaimer={m["mirror.disclaimer"]()}
    {healthNotice}
  />
{/if}
