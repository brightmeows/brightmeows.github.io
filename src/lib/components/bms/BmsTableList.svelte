<script lang="ts">
  import { linkInline } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { TableEntry } from "#lib/types/bms-view.js";

  interface Props {
    tables: TableEntry[];
  }

  let { tables }: Props = $props();
</script>

<div>
  <h2 id="bms-table-list-heading" class="section-title text-center">{m["table.list_heading"]()}</h2>
  <!-- 键盘滚动入口是响应式表格指南的强制项，region 非交互属 a11y 规则误报 -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="table-wrapper mt-4"
    role="region"
    tabindex="0"
    aria-labelledby="bms-table-list-heading"
  >
    <table class="table-glass">
      <colgroup>
        <col class="w-40" />
        <col class="w-[320px]" />
        <col class="w-40" />
      </colgroup>
      <thead>
        <tr>
          <th class="table-th-glass" scope="col">{m["common.th_symbol"]()}</th>
          <th class="table-th-glass" scope="col">{m["common.th_name"]()}</th>
          <th class="table-th-glass" scope="col">ID</th>
        </tr>
      </thead>
      <tbody>
        {#each tables as table (table.id)}
          <tr class="transition-colors hover:bg-white-5">
            <th
              scope="row"
              class="table-td-glass text-left font-normal wrap-break-word text-white-80"
              >{table.symbol ?? ""}</th
            >
            <td class="table-td-glass wrap-break-word">
              <a href={`/bms/table/${table.id}`} class={linkInline}>
                {table.name}
              </a>
            </td>
            <td class="table-td-glass wrap-break-word text-white-60">{table.id}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
