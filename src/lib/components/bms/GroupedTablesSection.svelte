<script lang="ts">
  import JsonPreview, { jsonPreview } from "$lib/components/JsonPreview.svelte";
  import ScrollSyncGroup from "$lib/components/ScrollSyncGroup.svelte";
  import type { MirrorTableItem, Tag1Group, Tag2Group } from "$lib/types/bms";
  import { slugifyTag } from "$lib/utils/mirror-tables";

  const CheckboxState = {
    Unchecked: 0,
    Indeterminate: 1,
    Checked: 2,
  } as const;

  type CheckboxState = (typeof CheckboxState)[keyof typeof CheckboxState];

  interface Props {
    groups?: Tag1Group[];
    selectedMap?: Record<string, boolean>;
  }

  let { groups = [], selectedMap = $bindable({}) }: Props = $props();

  let tablePreview = $state<
    | {
        show: (
          options: import("$lib/components/JsonPreview.svelte").JsonPreviewShowOptions,
          clientX: number,
          clientY: number
        ) => void | Promise<void>;
        scheduleHide: () => void;
        hideNow: () => void;
      }
    | undefined
  >();

  function compareAscii(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function sortedItems(items: MirrorTableItem[]): MirrorTableItem[] {
    return [...items].sort((a, b) => {
      const byName = compareAscii(a.name, b.name);
      if (byName !== 0) return byName;
      return compareAscii(a.url, b.url);
    });
  }

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

  function indeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = !!value;
    return {
      update(v: boolean) {
        node.indeterminate = !!v;
      },
    };
  }
</script>

{#if groups.length === 0}
  <div class="p-12 text-center">
    <div class="mb-4 text-[4rem]">📊</div>
    <h3 class="mb-4 text-white">暂无镜像数据</h3>
    <p class="text-white/70">未找到镜像列表。</p>
  </div>
{:else}
  <div class="mt-8">
    <ScrollSyncGroup watchKeys={groups} let:setRef>
      <div class="mt-6 mb-8">
        {#each groups as g (g.tag1)}
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <button
              class="cursor-pointer rounded-[18px] bg-white/10 px-4 py-2 font-bold text-white opacity-80 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:opacity-90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
              type="button"
              onclick={() => scrollToTag1(g.tag1)}
            >
              {g.tag1}
            </button>
            {#if g.subgroups.length > 0}
              <span class="mx-1 text-white/40">|</span>
            {/if}
            {#each g.subgroups as sg (sg.tag2)}
              <button
                class="cursor-pointer rounded-[18px] bg-white/10 px-4 py-2 font-bold text-white opacity-80 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:opacity-90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                type="button"
                onclick={() => scrollToTag2(g.tag1, sg.tag2)}
              >
                {sg.tag2}
                <span class="rounded-[10px] bg-black/20 px-2 py-[0.1rem] text-[0.9rem] opacity-90">
                  ({sg.items.length})
                </span>
              </button>
            {/each}
          </div>
        {/each}
      </div>

      {#each groups as g (g.tag1)}
        <div id={`tag1-group-${slugifyTag(g.tag1)}`} class="mb-12 scroll-mt-5">
          <div class="mb-6 border-b-2 border-white/10 pb-4">
            <div class="flex items-center gap-4">
              <input
                type="checkbox"
                class="h-5.5 w-5.5 scale-[1.2]"
                use:indeterminate={tag1State(g, selectedMap) === CheckboxState.Indeterminate}
                checked={tag1State(g, selectedMap) === CheckboxState.Checked}
                onchange={(e) => onTag1Change(e.currentTarget.checked, g)}
              />
              <span
                class="rounded-[20px] bg-[rgba(100,181,246,0.3)] px-6 py-2 text-[1.2rem] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
              >
                分类 {g.tag1}
              </span>
            </div>
          </div>

          {#each g.subgroups as sg (sg.tag2)}
            <div id={`tag2-group-${slugifyTag(g.tag1)}-${slugifyTag(sg.tag2)}`} class="mt-4">
              <h3 class="mt-2 mb-2 flex items-center gap-2 text-[1.1rem] text-white">
                <input
                  type="checkbox"
                  class="h-5.5 w-5.5 scale-[1.2]"
                  use:indeterminate={tag2State(sg, selectedMap) === CheckboxState.Indeterminate}
                  checked={tag2State(sg, selectedMap) === CheckboxState.Checked}
                  onchange={(e) => onTag2Change(e.currentTarget.checked, sg)}
                />
                {sg.tag2}
              </h3>
              <div
                class="overflow-x-auto rounded-[10px] border border-white/10 bg-black/20"
                use:setRef
              >
                <table class="w-full min-w-200 table-fixed border-collapse">
                  <colgroup>
                    <col class="w-15" />
                    <col class="w-30" />
                    <col class="w-[320px]" />
                    <col class="w-40" />
                    <col class="w-40" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        class="border-b-2 border-white/10 bg-[rgba(100,181,246,0.2)] p-4 text-left font-semibold text-white"
                      >
                        选择
                      </th>
                      <th
                        class="border-b-2 border-white/10 bg-[rgba(100,181,246,0.2)] p-4 text-left font-semibold text-white"
                      >
                        符号
                      </th>
                      <th
                        class="border-b-2 border-white/10 bg-[rgba(100,181,246,0.2)] p-4 text-left font-semibold text-white"
                      >
                        名称
                      </th>
                      <th
                        class="border-b-2 border-white/10 bg-[rgba(100,181,246,0.2)] p-4 text-left font-semibold text-white"
                      >
                        镜像
                      </th>
                      <th
                        class="border-b-2 border-white/10 bg-[rgba(100,181,246,0.2)] p-4 text-left font-semibold text-white"
                      >
                        原链接
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each sortedItems(sg.items) as item (item.url)}
                      <tr class="hover:bg-white/5 last:[&>td]:border-b-0">
                        <td class="border-b border-white/5 p-4 wrap-break-word text-white/90">
                          <input
                            type="checkbox"
                            class="h-5.5 w-5.5 scale-[1.2]"
                            checked={!!selectedMap[item.url]}
                            onchange={(e) => onRowChange(e.currentTarget.checked, item.url)}
                          />
                        </td>
                        <td class="border-b border-white/5 p-4 wrap-break-word text-white/90">
                          {item.symbol ?? ""}
                        </td>
                        <td
                          class="min-w-50 border-b border-white/5 p-4 wrap-break-word text-white/90"
                        >
                          <strong
                            class="cursor-default"
                            use:jsonPreview={{
                              preview: tablePreview,
                              options: {
                                value: item,
                                label: `${item.name ?? "难度表"} JSON`,
                                maxHeightRem: 14,
                              },
                            }}
                          >
                            {item.name}
                          </strong>
                        </td>
                        <td
                          class="min-w-32.5 border-b border-white/5 p-4 wrap-break-word text-white/90"
                        >
                          <a
                            class="flex min-w-15 cursor-pointer items-center justify-center gap-[0.2rem] rounded-md border-none bg-[linear-gradient(135deg,#2196f3,#1565c0)] px-2 py-[0.35rem] text-[0.85rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#42a5f5,#1976d2)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
                            href={item.url}
                            title={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            镜像
                          </a>
                        </td>
                        <td
                          class="min-w-32.5 border-b border-white/5 p-4 wrap-break-word text-white/90"
                        >
                          {#if item.url_from}
                            <a
                              class="flex min-w-15 cursor-pointer items-center justify-center gap-[0.2rem] rounded-md border-none bg-[linear-gradient(135deg,#ff9800,#f57c00)] px-2 py-[0.35rem] text-[0.85rem] font-semibold text-white no-underline transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ffb74d,#ff9800)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
                              href={item.url_from}
                              title={item.url_from}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              原链接
                            </a>
                          {:else}
                            <span class="text-white/50">无</span>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </ScrollSyncGroup>
  </div>
{/if}

<JsonPreview bind:this={tablePreview} />
