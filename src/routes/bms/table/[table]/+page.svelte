<script lang="ts">
  import { draftStorageKey } from "@brightmeows/bms/editor";
  import { onMount } from "svelte";

  import { page } from "$app/state";
  import BmsTablePage from "$lib/components/pages/BmsTablePage.svelte";
  import { SITE_ORIGIN, isStaticHost } from "$lib/constants/site";

  // 自托管表数据在站内静态目录：header 与 data 与查看页同一来源。
  const table = $derived(page.params.table ?? "");

  // 静态宿主上 API 在主站：另存共享走“导出并跳主站”的桥接路径
  let bridge = $state(false);
  onMount(() => {
    bridge = isStaticHost();
  });
</script>

{#if table !== ""}
  <BmsTablePage
    source={{
      headerUrl: `/bms/table/${table}/header.json`,
      dataUrlFallback: `/bms/table/${table}/data.json`,
      draftKey: draftStorageKey("self", table),
    }}
    publish={{ saveAsShared: bridge ? "bridge" : "same-origin", siteOrigin: SITE_ORIGIN }}
  />
{/if}
