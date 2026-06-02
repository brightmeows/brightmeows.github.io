<script lang="ts">
  import { page } from "$app/state";
  import BmsTablePage from "$lib/components/bms/BmsTablePage.svelte";

  let table = $derived(page.params.table);
  let headerUrl = $derived(`/bms/table/mirror/${table}/header.json`);
  let breadcrumbKey = $derived(`breadcrumb-bms-table-mirror-${table}`);
</script>

<BmsTablePage {headerUrl} breadcrumbSessionKey={breadcrumbKey} />
