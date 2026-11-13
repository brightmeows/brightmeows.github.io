<script lang="ts">
  import type { SharedAuthorGroup } from "@brightmeows/bms/shared";
  import type { SharedTableItem } from "@brightmeows/mirror/shared";

  import SharedTableRow from "./SharedTableRow.svelte";

  import EmptyState from "#lib/components/ui/EmptyState.svelte";
  import { badgeAccentXs } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import { slugifyTag } from "#lib/utils/mirror-tables.js";

  /**
   * 共享表的分组列表：按作者分组（组头 GitHub login），行结构与镜像列表
   * 同一套玻璃表格样式；交互只有编辑与删除（选择/预览聚合是镜像专有）。
   */
  interface Props {
    groups: SharedAuthorGroup[];
    /** 当前登录账号；null 即未登录（隐藏行内操作）。 */
    login?: string | null;
    isAdmin?: boolean;
    /** 删除进行中的表 id。 */
    deletingId?: string | null;
    /** 无匹配结果时的空态描述（搜索/筛选场景与全空区分）。 */
    emptyTitle?: string;
    emptyDescription?: string;
    ondelete?: ((item: SharedTableItem) => void) | undefined;
  }

  let {
    groups,
    login = null,
    isAdmin = false,
    deletingId = null,
    emptyTitle = m["shared.list.empty_title"](),
    emptyDescription = m["shared.list.empty_desc"](),
    ondelete,
  }: Props = $props();

  const showActions = $derived(login !== null || isAdmin);
</script>

{#if groups.length === 0}
  <div class="mt-6">
    <EmptyState title={emptyTitle} description={emptyDescription} headingLevel={3} />
  </div>
{:else}
  <div class="mt-8">
    {#each groups as group, gi (group.author)}
      <div id={`shared-author-${slugifyTag(group.author)}`} class="mb-12 scroll-mt-5">
        <div class="section-divider">
          <div class="flex items-center gap-3">
            <span class="tag-accent">{group.author}</span>
            {#if group.isSelf}
              <span class={badgeAccentXs}>
                {m["shared.mine.badge"]()}
              </span>
            {/if}
            <span class="text-[0.9rem] text-white-50">
              {m["shared.list.count"]({ count: group.items.length })}
            </span>
          </div>
        </div>
        <!-- 键盘滚动入口是响应式表格指南的强制项，region 非交互属 a11y 规则误报 -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="table-wrapper mt-4"
          class:cv-defer={gi > 0}
          role="region"
          tabindex="0"
          aria-label={m["common.table_scroll_region"]()}
        >
          <table class="w-full min-w-150 table-fixed border-collapse">
            <colgroup>
              <col class="w-24" />
              <col class="w-[320px]" />
              <col class="w-32" />
              <col class="w-48" />
              {#if showActions}<col class="w-24" />{/if}
            </colgroup>
            <thead>
              <tr>
                <th class="table-th-glass" scope="col">{m["common.th_symbol"]()}</th>
                <th class="table-th-glass" scope="col">{m["common.th_name"]()}</th>
                <th class="table-th-glass" scope="col">{m["shared.th.entries"]()}</th>
                <th class="table-th-glass" scope="col">{m["shared.th.updated"]()}</th>
                {#if showActions}
                  <th class="table-th-glass px-2 whitespace-nowrap" scope="col"
                    >{m["shared.th.actions"]()}</th
                  >
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each group.items as item (item.id)}
                <SharedTableRow
                  {item}
                  canEdit={login === item.author}
                  canDelete={login === item.author || isAdmin}
                  deleting={deletingId === item.id}
                  {ondelete}
                />
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/each}
  </div>
{/if}
