<script lang="ts">
  import { page } from "$app/state";
  import { BmsTablePage } from "$lib/components/pages";
  import { r2TableHeaderUrl } from "$lib/constants/r2";

  let table = $derived(page.params.table);
  let headerUrl = $derived(r2TableHeaderUrl(table));
</script>

<BmsTablePage {headerUrl} />
