<script lang="ts">
  import type { PageData } from "./$types";

  import BmsTablePage from "$lib/components/bms/BmsTablePage.svelte";

  let { data }: { data: PageData } = $props();
</script>

<BmsTablePage
  headerUrl={data.headerUrl}
  originUrl={data.originUrl}
  breadcrumbSessionKey={`breadcrumb-bms-table-${data.headerUrl}`}
  showExtraLinks={true}
/>
