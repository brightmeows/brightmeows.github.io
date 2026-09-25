<script lang="ts">
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { LevelRefItem } from "$lib/types/bms";
  import { resolveUrl } from "$lib/utils/url";

  interface Props {
    headerUrl?: string;
    hasData?: boolean;
    loadState?: "idle" | "loading" | "done" | "not-found" | "error";
  }

  let {
    headerUrl = undefined,
    hasData = $bindable(false),
    loadState = $bindable("idle"),
  }: Props = $props();

  let levelRefData = $state<LevelRefItem[]>([]);
  let loadErrorMessage = $state("");

  let requestToken = 0;

  let hasContent = $derived(levelRefData.length > 0);

  let tableHalves = $derived.by(() => {
    const midIndex = Math.ceil(levelRefData.length / 2);
    return [
      { id: "left" as const, items: levelRefData.slice(0, midIndex) },
      { id: "right" as const, items: levelRefData.slice(midIndex) },
    ];
  });

  function buildLevelRefUrl(headerUrlRaw: string): string {
    try {
      let url = headerUrlRaw;
      if (!/^https?:\/\//i.test(url)) {
        url = resolveUrl(headerUrlRaw);
      }
      const parts = url.split("/");
      parts[parts.length - 1] = "level-ref.json";
      return parts.join("/");
    } catch (err) {
      console.error("构建 level-ref.json URL 失败:", err);
      return "";
    }
  }

  async function loadLevelRefData(header: string | undefined): Promise<void> {
    if (!header) return;

    requestToken += 1;
    const token = requestToken;

    loadState = "loading";
    loadErrorMessage = "";

    try {
      const levelRefUrl = buildLevelRefUrl(header);
      if (!levelRefUrl) {
        loadState = "error";
        loadErrorMessage = m["levelref.url_build_failed"]();
        return;
      }

      const response = await fetch(levelRefUrl);
      if (token !== requestToken) return;

      if (response.ok) {
        const data = (await response.json()) as LevelRefItem[];
        if (token !== requestToken) return;

        if (Array.isArray(data)) {
          levelRefData = data;
          loadState = "done";
        } else {
          console.warn("level-ref.json 格式不正确，应为数组");
          loadState = "error";
          loadErrorMessage = m["levelref.bad_format"]();
        }
      } else if (response.status === 404) {
        loadState = "not-found";
      } else {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error("加载难度对照表数据失败:", err);
      loadState = "error";
      loadErrorMessage = err instanceof Error ? err.message : m["common.unknown_error"]();
    }
  }

  $effect(() => {
    void loadLevelRefData(headerUrl);
  });

  $effect(() => {
    hasData = hasContent;
  });
</script>

{#if loadState === "loading"}
  <h3 class="section-title mt-0 mb-6 text-center">{m["levelref.heading"]()}</h3>
  <LoadingProgress variant="compact" message={m["levelref.loading"]()} />
{:else if loadState === "error"}
  <h3 class="section-title mt-0 mb-6 text-center">{m["levelref.heading"]()}</h3>
  <div class="message-error">
    {m["common.load_failed_with_error"]({ error: loadErrorMessage })}
  </div>
{:else if hasContent}
  <h3 class="section-title mt-0 mb-6 text-center">{m["levelref.heading"]()}</h3>
  <div class="flex flex-wrap items-start justify-center gap-8">
    {#each tableHalves as half (half.id)}
      <div class="min-w-[18rem] flex-1">
        <table class="table-glass">
          <colgroup>
            {#each ["40%", "60%"] as w (w)}
              <col style={`width: ${w}`} />
            {/each}
          </colgroup>
          <thead>
            <tr>
              {#each [m["levelref.col_level"](), m["levelref.col_ref"]()] as label (label)}
                <th class="table-th-glass text-center">
                  {label}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each half.items as item (item.level)}
              <tr class="hover:bg-white/5 last:[&>td]:border-b-0">
                <td class="table-td-glass text-center">
                  {item.level}
                </td>
                <td class="table-td-glass text-center">
                  {item.ref}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  </div>
{/if}
