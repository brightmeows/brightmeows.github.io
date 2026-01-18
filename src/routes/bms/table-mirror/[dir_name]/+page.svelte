<script lang="ts">
  import BmsTablePage from "$lib/components/bms/BmsTablePage.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<BmsTablePage
  headerUrl={data.headerUrl}
  originUrl={data.originUrl}
  breadcrumbSessionKey={`breadcrumb-bms-table-${data.headerUrl}`}
  showExtraLinks={true}
/>
