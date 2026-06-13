<script lang="ts">
  import { page } from "$app/state";
  import { BmsTablePage } from "$lib/components/pages";
  import { R2_TABLES_BASE } from "$lib/constants/r2";

  let table = $derived(page.params.table);
  let headerUrl = $derived(`${R2_TABLES_BASE}/${encodeURIComponent(table)}/header.json`);
</script>

<BmsTablePage {headerUrl} />
