<script lang="ts">
  import { page } from "$app/stores";
  import BmsTablePage from "$lib/components/bms/BmsTablePage.svelte";

  $: table = $page.params.table;
  $: headerUrl = `/bms/table/mirror/${table}/header.json`;
  $: breadcrumbKey = `breadcrumb-bms-table-mirror-${table}`;
</script>

<BmsTablePage {headerUrl} breadcrumbSessionKey={breadcrumbKey} />
