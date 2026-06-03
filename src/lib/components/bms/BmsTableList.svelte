<script lang="ts">
  import { resolve } from "$app/paths";

  interface TableEntry {
    id: string;
    name: string;
  }

  interface Props {
    tables: TableEntry[];
  }

  let { tables }: Props = $props();
</script>

<div class="table-wrapper">
  <table class="table-glass">
    <colgroup>
      <col class="w-[320px]" />
      <col class="w-40" />
    </colgroup>
    <thead>
      <tr>
        <th class="table-th-glass">名称</th>
        <th class="table-th-glass">ID</th>
      </tr>
    </thead>
    <tbody>
      {#each tables as table (table.id)}
        <tr class="transition-colors hover:bg-white/5">
          <td class="table-td-glass wrap-break-word">
            <a
              href={resolve(`/bms/table/${table.id}`, {})}
              class="text-[#64b5f6] no-underline transition-colors hover:text-[#90caf9]"
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
