<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";

  import MirrorTableRow from "./MirrorTableRow.svelte";

  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ScrollSyncGroup from "$lib/components/ui/ScrollSyncGroup.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { MirrorAdminUi, Tag1Group, Tag2Group } from "$lib/types/bms";
  import type { JsonPreviewHandle } from "$lib/types/ui";
  import { slugifyTag } from "$lib/utils/mirror-tables";

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
  }

  let {
    adminUi,
    groups = [],
    selectedMap = $bindable({}),
    mirrorPreview,
    showDelete = false,
    deletingDir = null,
    ondelete,
  }: Props = $props();

  // 操作列需容纳“编辑与删除”：管理员或已登录用户可见；匿名访客保持六列
  const showActions = $derived(adminUi.isAdmin || showDelete);

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
  <div class="mt-8">
    <ScrollSyncGroup watchKeys={groups}>
      {#snippet children({ setRef })}
        <div class="mt-6 mb-8">
          {#each groups as g (g.tag1)}
            <div class="mb-4 flex flex-wrap items-center gap-2">
              <button class="tag-scroll" type="button" onclick={() => scrollToTag1(g.tag1)}>
                {g.tag1}
              </button>
              {#if g.subgroups.length > 0}
                <span class="mx-1 text-white/40">|</span>
              {/if}
              {#each g.subgroups as sg (sg.tag2)}
                <button
                  class="tag-scroll"
                  type="button"
                  onclick={() => scrollToTag2(g.tag1, sg.tag2)}
                >
                  {sg.tag2}
                  <span
                    class="rounded-[10px] bg-black/20 px-2 py-[0.1rem] text-[0.9rem] opacity-90"
                  >
                    ({sg.items.length})
                  </span>
                </button>
              {/each}
            </div>
          {/each}
        </div>

        {#each groups as g (g.tag1)}
          <div id={`tag1-group-${slugifyTag(g.tag1)}`} class="mb-12 scroll-mt-5">
            <div class="section-divider">
              <div class="flex items-center gap-4">
                <Checkbox
                  checked={tag1State(g, selectedMap) === CheckboxState.Checked}
                  indeterminate={tag1State(g, selectedMap) === CheckboxState.Indeterminate}
                  onchange={(v: boolean) => onTag1Change(v, g)}
                />
                <span class="tag-accent">
                  {g.tag1}
                </span>
              </div>
            </div>

            {#each g.subgroups as sg (sg.tag2)}
              <div id={`tag2-group-${slugifyTag(g.tag1)}-${slugifyTag(sg.tag2)}`} class="mt-4">
                <div class="mt-2 mb-2 flex items-center gap-2">
                  <Checkbox
                    checked={tag2State(sg, selectedMap) === CheckboxState.Checked}
                    indeterminate={tag2State(sg, selectedMap) === CheckboxState.Indeterminate}
                    onchange={(v: boolean) => onTag2Change(v, sg)}
                  />
                  <h3 class="tag-accent-sm">
                    {sg.tag2}
                  </h3>
                </div>
                <div class="table-wrapper" use:setRef>
                  <table class="w-full min-w-200 table-fixed border-collapse">
                    <colgroup>
                      <col class="w-15" />
                      <col class="w-30" />
                      <col class="w-[320px]" />
                      <col class="w-16" />
                      <col class="w-40" />
                      <col class="w-40" />
                      {#if showActions}<col class="w-16" />{/if}
                    </colgroup>
                    <thead>
                      <tr>
                        <th class="table-th-glass">{m["common.th_select"]()}</th>
                        <th class="table-th-glass">{m["common.th_symbol"]()}</th>
                        <th class="table-th-glass">{m["common.th_name"]()}</th>
                        <th class="table-th-glass px-2 whitespace-nowrap"
                          >{m["mirror.th_auth"]()}</th
                        >
                        <th class="table-th-glass">{m["common.th_mirror"]()}</th>
                        <th class="table-th-glass">{m["common.th_origin"]()}</th>
                        {#if showActions}
                          <th class="table-th-glass px-2 whitespace-nowrap"
                            >{m["mirror.th_actions"]()}</th
                          >
                        {/if}
                      </tr>
                    </thead>
                    <tbody>
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
                    </tbody>
                  </table>
                </div>
              </div>
            {/each}
          </div>
        {/each}
      {/snippet}
    </ScrollSyncGroup>
  </div>
{/if}
