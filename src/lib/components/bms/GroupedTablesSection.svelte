<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";

  import MirrorTableRow from "./MirrorTableRow.svelte";

  import Checkbox from "#lib/components/ui/Checkbox.svelte";
  import DetailsPanel from "#lib/components/ui/DetailsPanel.svelte";
  import EmptyState from "#lib/components/ui/EmptyState.svelte";
  import ScrollSyncGroup from "#lib/components/ui/ScrollSyncGroup.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { MirrorAdminUi, Tag1Group, Tag2Group } from "#lib/types/bms-view.js";
  import type { JsonPreviewHandle } from "#lib/types/ui.js";
  import { slugifyTag } from "#lib/utils/mirror-tables.js";

  // 值域与类型域同名合并是标准 TS 惯用法；oxlint 误报 no-redeclare（typescript-eslint 不报）
  // oxlint-disable-next-line no-redeclare
  const CheckboxState = {
    Unchecked: 0,
    Indeterminate: 1,
    Checked: 2,
  } as const;

  type CheckboxState = (typeof CheckboxState)[keyof typeof CheckboxState];

  interface Props {
    adminUi: MirrorAdminUi;
    groups?: Tag1Group[];
    selectedMap?: Record<string, boolean>;
    mirrorPreview?: JsonPreviewHandle | undefined;
    /** 是否显示删除按钮（已登录）。 */
    showDelete?: boolean;
    /** 删除进行中的目录名。 */
    deletingDir?: string | null;
    ondelete?: ((item: MirrorTableItem) => void) | undefined;
    /** 操作模式：打开后每行显示管理或删除入口。 */
    operationsMode?: boolean;
  }

  let {
    adminUi,
    groups = [],
    selectedMap = $bindable({}),
    mirrorPreview,
    showDelete = false,
    deletingDir = null,
    ondelete,
    operationsMode = false,
  }: Props = $props();

  // 操作列只在操作模式打开时出现，默认列表保持六列
  const showActions = $derived(operationsMode);
  const columnCount = $derived(showActions ? 7 : 6);

  function scrollToTag1(tag1: string): void {
    const id = `tag1-group-${slugifyTag(tag1)}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function scrollToTag2(tag1: string, tag2: string): void {
    const id = `tag2-group-${slugifyTag(tag1)}-${slugifyTag(tag2)}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function getTag1Urls(g: Tag1Group): string[] {
    const urls: string[] = [];
    for (const sg of g.subgroups) {
      for (const item of sg.items) {
        urls.push(item.url);
      }
    }
    return urls;
  }

  function getTag2Urls(sg: Tag2Group): string[] {
    return sg.items.map((item) => item.url);
  }

  function aggregateCheckboxState(urls: string[], map: Record<string, boolean>): CheckboxState {
    if (urls.length === 0) return CheckboxState.Unchecked;
    let selected = 0;
    for (const u of urls) if (map[u]) selected++;
    if (selected === 0) return CheckboxState.Unchecked;
    if (selected === urls.length) return CheckboxState.Checked;
    return CheckboxState.Indeterminate;
  }

  function tag1State(g: Tag1Group, map: Record<string, boolean>): CheckboxState {
    return aggregateCheckboxState(getTag1Urls(g), map);
  }

  function tag2State(sg: Tag2Group, map: Record<string, boolean>): CheckboxState {
    return aggregateCheckboxState(getTag2Urls(sg), map);
  }

  function onTag1Change(checked: boolean, g: Tag1Group): void {
    const next = { ...selectedMap };
    for (const url of getTag1Urls(g)) {
      next[url] = checked;
    }
    selectedMap = next;
  }

  function onTag2Change(checked: boolean, sg: Tag2Group): void {
    const next = { ...selectedMap };
    for (const url of getTag2Urls(sg)) {
      next[url] = checked;
    }
    selectedMap = next;
  }

  function onRowChange(checked: boolean, url: string): void {
    selectedMap = { ...selectedMap, [url]: checked };
  }
</script>

{#if groups.length === 0}
  <EmptyState title={m["mirror.empty_title"]()} description={m["mirror.empty_desc"]()} />
{:else}
  <div class="flex flex-col gap-3">
    <ScrollSyncGroup watchKeys={groups}>
      {#snippet children({ setRef })}
        <DetailsPanel
          summary={m["mirror.tag_nav"]()}
          hint={m["mirror.tag_nav_hint"]({ count: groups.length })}
          variant="plain"
          sub={true}
        >
          <div class="flex flex-wrap items-center gap-2">
            {#each groups as g (g.tag1)}
              <button class="tag-scroll" type="button" onclick={() => scrollToTag1(g.tag1)}>
                {g.tag1}
              </button>
              {#if g.subgroups.length > 0}
                <span class="mx-1 text-text-secondary">|</span>
              {/if}
              {#each g.subgroups as sg (sg.tag2)}
                <button
                  class="tag-scroll"
                  type="button"
                  onclick={() => scrollToTag2(g.tag1, sg.tag2)}
                >
                  {sg.tag2}
                  <span class="rounded-[10px] bg-canvas px-2 py-[0.1rem] text-[0.9rem] opacity-90">
                    ({sg.items.length})
                  </span>
                </button>
              {/each}
            {/each}
          </div>
        </DetailsPanel>

        <div class="table-wrapper lg:overflow-visible" use:setRef>
          <table class="w-full min-w-200 table-fixed border-collapse">
            <colgroup>
              <col class="w-15" />
              <col class="w-30" />
              <col class="w-[320px]" />
              <col class="w-16" />
              <col class="w-40" />
              <col class="w-40" />
              {#if showActions}<col class="w-28" />{/if}
            </colgroup>
            <thead>
              <tr>
                <th class="table-th-compact table-th-sticky">{m["common.th_select"]()}</th>
                <th class="table-th-compact table-th-sticky">{m["common.th_symbol"]()}</th>
                <th class="table-th-compact table-th-sticky">{m["common.th_name"]()}</th>
                <th class="table-th-compact table-th-sticky px-2 whitespace-nowrap"
                  >{m["mirror.th_auth"]()}</th
                >
                <th class="table-th-compact table-th-sticky">{m["common.th_mirror"]()}</th>
                <th class="table-th-compact table-th-sticky">{m["common.th_origin"]()}</th>
                {#if showActions}
                  <th class="table-th-compact table-th-sticky px-2 whitespace-nowrap"
                    >{m["mirror.th_actions"]()}</th
                  >
                {/if}
              </tr>
            </thead>
            {#each groups as g (g.tag1)}
              {@const tag1 = tag1State(g, selectedMap)}
              <tbody id={`tag1-group-${slugifyTag(g.tag1)}`} class="scroll-mt-20">
                <tr>
                  <td
                    colspan={columnCount}
                    class="border-b-2 border-border-subtle bg-canvas-strong px-4 py-2"
                  >
                    <div class="flex items-center gap-3">
                      <Checkbox
                        ariaLabel={m["mirror.select_group_aria"]({ name: g.tag1 })}
                        checked={tag1 === CheckboxState.Checked}
                        indeterminate={tag1 === CheckboxState.Indeterminate}
                        onchange={(v: boolean) => onTag1Change(v, g)}
                      />
                      <span class="tag-accent-sm">{g.tag1}</span>
                    </div>
                  </td>
                </tr>
                {#each g.subgroups as sg (sg.tag2)}
                  {@const tag2 = tag2State(sg, selectedMap)}
                  <tr
                    id={`tag2-group-${slugifyTag(g.tag1)}-${slugifyTag(sg.tag2)}`}
                    class="scroll-mt-20"
                  >
                    <td
                      colspan={columnCount}
                      class="border-b border-border-subtle bg-surface-subtle px-4 py-2"
                    >
                      <div class="flex items-center gap-2">
                        <Checkbox
                          ariaLabel={m["mirror.select_group_aria"]({ name: sg.tag2 })}
                          checked={tag2 === CheckboxState.Checked}
                          indeterminate={tag2 === CheckboxState.Indeterminate}
                          onchange={(v: boolean) => onTag2Change(v, sg)}
                        />
                        <h3 class="tag-accent-sm">{sg.tag2}</h3>
                        <span class="text-[0.85rem] text-text-secondary">
                          ({sg.items.length})
                        </span>
                      </div>
                    </td>
                  </tr>
                  {#each sg.items as item (item.url)}
                    <MirrorTableRow
                      {item}
                      selected={!!selectedMap[item.url]}
                      onchange={(checked: boolean) => onRowChange(checked, item.url)}
                      {adminUi}
                      {showActions}
                      canDelete={showDelete}
                      {mirrorPreview}
                      deleting={deletingDir === item.dir_name}
                      {ondelete}
                    />
                  {/each}
                {/each}
              </tbody>
            {/each}
          </table>
        </div>
      {/snippet}
    </ScrollSyncGroup>
  </div>
{/if}
