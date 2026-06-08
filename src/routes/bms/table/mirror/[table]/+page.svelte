<script lang="ts">
  import { page } from "$app/state";
  import BmsTablePage from "$lib/components/pages/BmsTablePage.svelte";
  import { R2_TABLES_BASE } from "$lib/data/bms-constants";

  let table = $derived(page.params.table);
  let headerUrl = $derived(`${R2_TABLES_BASE}/${encodeURIComponent(table)}/header.json`);
</script>

<BmsTablePage {headerUrl} />
