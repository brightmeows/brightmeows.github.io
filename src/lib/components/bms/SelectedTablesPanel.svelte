<script lang="ts">
  import type { MirrorTableItem } from "@brightmeows/mirror/types";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { jsonPreview } from "$lib/components/ui/JsonPreview.svelte";
  import type { JsonPreviewHandle } from "$lib/types/ui";

  interface Props {
    tables?: MirrorTableItem[];
    selectedMap?: Record<string, boolean>;
    mirrorPreview?: JsonPreviewHandle | undefined;
    /** 显示顺序 URL 列表，用于 JSON 输出排序 */
    displayOrderUrls?: string[];
  }

  let {
    tables = [],
    selectedMap = $bindable({}),
    mirrorPreview,
    displayOrderUrls = [],
  }: Props = $props();

  let totalCount = $derived(tables.length);
  let selectedCount = $derived(Object.values(selectedMap).filter(Boolean).length);
  let allSelected = $derived(selectedCount === totalCount && totalCount > 0);
  let someSelected = $derived(selectedCount > 0 && selectedCount < totalCount);

  function handleSelectAll(checked: boolean): void {
    const next: Record<string, boolean> = {};
    for (const t of tables) {
      next[t.url] = checked;
    }
    selectedMap = next;
  }

  /** 按 displayOrderUrls 排序的选中镜像 URL 列表 */
  let selectedMirrorArray = $derived(
    Object.entries(selectedMap)
      .filter(([, v]) => !!v)
      .map(([url]) => url)
      .sort((a, b) => {
        const idxA = displayOrderUrls.indexOf(a);
        const idxB = displayOrderUrls.indexOf(b);
        // 均在 displayOrderUrls 中 → 按展示顺序
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        // 一个在展示列表中 → 优先
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        // 均不在 → 保持原顺序
        return 0;
      })
      .map((url) => new URL(url, window.location.origin).toString())
  );

  let urlToOrigin = $derived.by(() => {
    const m: Record<string, string> = {};
    for (const t of tables) {
      if (!t.url) continue;
      const mirrorAbs = new URL(t.url, window.location.origin).toString();
      const rawOri = String(t.url_from ?? "").trim();
      const oriAbs = rawOri.length > 0 ? new URL(rawOri, window.location.origin).toString() : "";
      m[mirrorAbs] = oriAbs;
    }
    return m;
  });

  let selectedOriginArray = $derived(
    selectedMirrorArray.map((u) => urlToOrigin[u] ?? "").filter((v) => v.length > 0)
  );
</script>

{#if selectedCount > 0}
  <div
    class="fixed bottom-4 left-1/2 z-999 max-w-[calc(100vw-2rem)] translate-x-[-50%] overflow-x-auto"
    in:fly={{ y: 24, opacity: 0, duration: 180, easing: cubicOut }}
    out:fly={{ y: 24, opacity: 0, duration: 140, easing: cubicIn }}
  >
    <div
      class="flex w-max flex-nowrap items-center gap-4 rounded-xl border border-white/20 bg-glass p-3 px-4 shadow-[0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur-[6px]"
    >
      <Checkbox
        checked={allSelected}
        indeterminate={someSelected}
        onchange={(v: boolean) => handleSelectAll(v)}
      />
      <div class="font-semibold whitespace-nowrap text-white">
        已选中 {selectedCount} / {totalCount}
      </div>
      <div class="flex flex-nowrap gap-3">
        <button
          class="gradient-btn gradient-btn-blue rounded-lg px-[0.8rem] py-2 text-[0.9rem]"
          type="button"
          use:jsonPreview={{
            preview: mirrorPreview,
            options: {
              value: selectedMirrorArray,
              label: "镜像链接 JSON",
              maxHeightRem: 12,
            },
          }}
        >
          镜像链接 JSON
        </button>
        <button
          class="gradient-btn gradient-btn-orange rounded-lg px-[0.8rem] py-2 text-[0.9rem]"
          type="button"
          use:jsonPreview={{
            preview: mirrorPreview,
            options: {
              value: selectedOriginArray,
              label: "原链接 JSON",
              maxHeightRem: 12,
            },
          }}
        >
          原链接 JSON
        </button>
      </div>
    </div>
  </div>
{/if}
