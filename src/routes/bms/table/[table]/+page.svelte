<script lang="ts">
  import { page } from "$app/state";
  import BmsTablePage from "$lib/components/pages/BmsTablePage.svelte";

  let table = $derived(page.params.table);
  let headerUrl = $derived(`/bms/table/${table}/header.json`);
</script>

<BmsTablePage {headerUrl} />
