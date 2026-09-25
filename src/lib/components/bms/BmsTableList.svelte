<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "$lib/paraglide/messages.js";
  import type { TableEntry } from "$lib/types/bms";

  interface Props {
    tables: TableEntry[];
  }

  let { tables }: Props = $props();
</script>

<div>
  <h2 class="section-title text-center">{m["table.list_heading"]()}</h2>
  <div class="table-wrapper mt-4">
    <table class="table-glass">
      <colgroup>
        <col class="w-40" />
        <col class="w-[320px]" />
        <col class="w-40" />
      </colgroup>
      <thead>
        <tr>
          <th class="table-th-glass">{m["common.th_symbol"]()}</th>
          <th class="table-th-glass">{m["common.th_name"]()}</th>
          <th class="table-th-glass">ID</th>
        </tr>
      </thead>
      <tbody>
        {#each tables as table (table.id)}
          <tr class="transition-colors hover:bg-white/5">
            <td class="table-td-glass wrap-break-word text-white/80">{table.symbol ?? ""}</td>
            <td class="table-td-glass wrap-break-word">
              <a
                href={resolve(`/bms/table/${table.id}`, {})}
                class="text-accent no-underline transition-colors hover:text-accent-light"
              >
                {table.name}
              </a>
            </td>
            <td class="table-td-glass wrap-break-word text-white/60">{table.id}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
