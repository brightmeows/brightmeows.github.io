<script lang="ts">
  import { cubicIn, cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";

  import JsonPreview, { jsonPreview } from "$lib/components/JsonPreview.svelte";

  interface MirrorTableItem {
    url: string;
    url_ori?: string;
  }

  export let tables: MirrorTableItem[] = [];
  export let selectedMap: Record<string, boolean> = {};

  let mirrorPreview:
    | {
        show: (
          options: import("$lib/components/JsonPreview.svelte").JsonPreviewShowOptions,
          clientX: number,
          clientY: number
        ) => void | Promise<void>;
        scheduleHide: () => void;
        hideNow: () => void;
      }
    | undefined;
  let originPreview:
    | {
        show: (
          options: import("$lib/components/JsonPreview.svelte").JsonPreviewShowOptions,
          clientX: number,
          clientY: number
        ) => void | Promise<void>;
        scheduleHide: () => void;
        hideNow: () => void;
      }
    | undefined;

  $: totalCount = tables.length;
  $: selectedCount = Object.values(selectedMap).filter(Boolean).length;

  $: selectedMirrorArray = Object.entries(selectedMap)
    .filter(([, v]) => !!v)
    .map(([url]) => new URL(url, window.location.origin).toString());

  $: urlToOrigin = (() => {
    const m: Record<string, string> = {};
    for (const t of tables) {
      if (!t.url) continue;
      const mirrorAbs = new URL(t.url, window.location.origin).toString();
      const rawOri = String(t.url_ori ?? "").trim();
      const oriAbs = rawOri.length > 0 ? new URL(rawOri, window.location.origin).toString() : "";
      m[mirrorAbs] = oriAbs;
    }
    return m;
  })();

  $: selectedOriginArray = selectedMirrorArray
    .map((u) => urlToOrigin[u] ?? "")
    .filter((v) => v.length > 0);
</script>

{#if selectedCount > 0}
  <div
    class="fixed bottom-4 left-1/2 z-999 max-w-[calc(100vw-2rem)] translate-x-[-50%] overflow-x-auto"
    in:fly={{ y: 24, opacity: 0, duration: 180, easing: cubicOut }}
    out:fly={{ y: 24, opacity: 0, duration: 140, easing: cubicIn }}
  >
    <div
      class="flex w-max flex-nowrap items-center gap-4 rounded-xl border border-white/20 bg-white/10 p-3 px-4 shadow-[0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur-[6px]"
    >
      <div class="font-semibold whitespace-nowrap text-white">
        已选中 {selectedCount} / {totalCount}
      </div>
      <div class="flex flex-nowrap gap-3">
        <button
          class="cursor-pointer rounded-lg border-none bg-[linear-gradient(135deg,#2196f3,#1565c0)] px-[0.8rem] py-2 text-[0.9rem] font-semibold text-white transition-all duration-200 ease-in-out"
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
          class="cursor-pointer rounded-lg border-none bg-[linear-gradient(135deg,#ff9800,#f57c00)] px-[0.8rem] py-2 text-[0.9rem] font-semibold text-white transition-all duration-200 ease-in-out"
          type="button"
          use:jsonPreview={{
            preview: originPreview,
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

<JsonPreview bind:this={mirrorPreview} />
<JsonPreview bind:this={originPreview} />
