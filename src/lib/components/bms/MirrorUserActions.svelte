<script lang="ts">
  import { onMount } from "svelte";

  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import { SITE_ORIGIN } from "$lib/constants/site";
  import { auth } from "$lib/data/auth-store.svelte";
  import {
    fetchFetchStatus,
    fetchPreview,
    fetchRemoved,
    submitAdd,
    submitRestore,
    type PreviewResult,
    type RemovedRecord,
  } from "$lib/data/mirror-user-api";
  import { m } from "$lib/paraglide/messages.js";

  interface Props {
    /** 添加或恢复成功后回调（用于刷新清单）。 */
    onchanged?: (() => void) | undefined;
  }

  let { onchanged }: Props = $props();

  let url = $state("");
  let preview = $state<PreviewResult | null>(null);
  let previewError = $state<string | null>(null);
  let previewing = $state(false);
  let submitting = $state(false);
  let progress = $state<string | null>(null);
  let notice = $state<{ kind: "ok" | "error"; text: string } | null>(null);

  let removed = $state<RemovedRecord[]>([]);
  let showRemoved = $state(false);
  let restoring = $state<string | null>(null);

  // 登录态在共享 store（顶栏同源）；回收站列表随首次就绪的登录态加载
  const unavailable = $derived(auth.status === "unavailable");
  const user = $derived(auth.user);

  let removedLoaded = $state(false);

  $effect(() => {
    if (auth.status === "ready" && auth.user !== null && !removedLoaded) {
      removedLoaded = true;
      void loadRemoved();
    }
  });

  async function loadRemoved(): Promise<void> {
    try {
      removed = await fetchRemoved();
    } catch {
      // 回收站列表读取失败不打断主流程
    }
  }

  /** 供父组件在删除等操作后刷新配额与回收站列表。 */
  export async function refresh(): Promise<void> {
    await auth.refresh();
    if (auth.user !== null) {
      await loadRemoved();
    }
  }

  onMount(() => {
    void auth.ensureLoaded();
  });

  async function doPreview(): Promise<void> {
    previewing = true;
    preview = null;
    previewError = null;
    notice = null;
    try {
      preview = await fetchPreview(url.trim());
    } catch (error) {
      previewError = error instanceof Error ? error.message : m["mirror.preview_failed"]();
    } finally {
      previewing = false;
    }
  }

  /** 轮询抓取状态，最多约 2 分钟。 */
  async function pollStatus(requestId: string): Promise<void> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const status = await fetchFetchStatus(requestId);
        if (status.state === "done") {
          progress = null;
          notice = { kind: "ok", text: m["mirror.fetch_done"]() };
          onchanged?.();
          return;
        }
        if (status.state === "failed") {
          progress = null;
          notice = {
            kind: "error",
            text: m["mirror.fetch_failed"]({
              reason: status.message ?? m["mirror.unknown_reason"](),
            }),
          };
          return;
        }
        progress = m["mirror.fetch_waiting"]({ seconds: (attempt + 1) * 3 });
      } catch {
        // 单次查询失败继续轮询
      }
    }
    progress = null;
    notice = { kind: "error", text: m["mirror.fetch_timeout"]() };
  }

  async function doAdd(): Promise<void> {
    submitting = true;
    notice = null;
    try {
      const result = await submitAdd(url.trim());
      url = "";
      preview = null;
      progress = m["mirror.submitted"]();
      auth.setRemaining(result.remaining);
      void pollStatus(result.requestId);
    } catch (error) {
      notice = {
        kind: "error",
        text: error instanceof Error ? error.message : m["mirror.submit_failed"](),
      };
    } finally {
      submitting = false;
    }
  }

  async function doRestore(dirName: string): Promise<void> {
    restoring = dirName;
    notice = null;
    try {
      const result = await submitRestore(dirName);
      notice = { kind: "ok", text: m["mirror.restored_done"]({ dir: dirName }) };
      auth.setRemaining(result.remaining);
      await loadRemoved();
      onchanged?.();
    } catch (error) {
      notice = {
        kind: "error",
        text: error instanceof Error ? error.message : m["mirror.restore_failed"](),
      };
    } finally {
      restoring = null;
    }
  }

  function formatRemovedAt(value: string): string {
    const at = Date.parse(value);
    if (!Number.isFinite(at)) return value;
    return new Date(at).toLocaleString();
  }

  const smallButton =
    "cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-[0.35rem] text-[0.85rem] whitespace-nowrap text-white/80 transition-all duration-200 ease-in-out hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
</script>

{#if unavailable}
  <GlassPanel class="mt-4 text-[0.95rem] text-white/75">
    {m["mirror.api_unavailable_before"]()}
    <a
      class="link-accent"
      href={`${SITE_ORIGIN}/bms/table/mirror/`}
      target="_blank"
      rel="noopener noreferrer">{m["mirror.api_unavailable_link"]()}</a
    >{m["mirror.api_unavailable_after"]()}
  </GlassPanel>
{:else if auth.status === "ready"}
  <GlassPanel class="mt-4">
    {#if user === null}
      <div class="text-[0.95rem] text-white/75">
        {m["mirror.login_hint"]()}
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        <div class="flex justify-end">
          <button class={smallButton} type="button" onclick={() => (showRemoved = !showRemoved)}>
            {m["mirror.removed_count"]({ count: removed.length })}
          </button>
        </div>

        <form
          class="flex flex-wrap items-center gap-2"
          onsubmit={(event) => {
            event.preventDefault();
            if (preview !== null && !submitting) void doAdd();
          }}
        >
          <input
            class="min-w-60 flex-1 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-white outline-none placeholder:text-white/50 focus:border-[#64b5f6]/60 focus:ring-2 focus:ring-[#64b5f6]/30"
            type="url"
            bind:value={url}
            placeholder={m["mirror.add_url_placeholder"]()}
            aria-label={m["mirror.add_url_aria"]()}
          />
          <button
            class={smallButton}
            type="button"
            disabled={previewing || url.trim() === ""}
            onclick={() => void doPreview()}
          >
            {previewing ? m["mirror.previewing"]() : m["mirror.preview"]()}
          </button>
          <button class={smallButton} type="submit" disabled={submitting || preview === null}>
            {submitting ? m["mirror.submitting"]() : m["mirror.submit"]()}
          </button>
        </form>

        {#if previewError}
          <div class="text-[0.9rem] text-amber-300">{previewError}</div>
        {/if}
        {#if preview}
          <div class="text-[0.9rem] text-white/70">
            {m["mirror.preview_result"]()}
            <strong class="text-white">{preview.name || m["mirror.no_name"]()}</strong>
            {preview.symbol ? m["mirror.preview_symbol"]({ symbol: preview.symbol }) : ""}{m[
              "mirror.preview_hint"
            ]()}
          </div>
        {/if}
        {#if progress}
          <div class="text-[0.9rem] text-[#64b5f6]">{progress}</div>
        {/if}
        {#if notice}
          <div class="text-[0.9rem] {notice.kind === 'ok' ? 'text-[#4caf50]' : 'text-red-300'}">
            {notice.text}
          </div>
        {/if}

        {#if showRemoved}
          <div class="rounded-lg border border-white/15 bg-black/20 p-3">
            {#if removed.length === 0}
              <div class="text-[0.9rem] text-white/60">{m["mirror.no_removed"]()}</div>
            {:else}
              <ul class="flex flex-col gap-2">
                {#each removed as record (record.dir_name)}
                  <li
                    class="flex flex-wrap items-center justify-between gap-2 text-[0.9rem] text-white/75"
                  >
                    <span>
                      {record.dir_name}
                      <span class="ml-2 text-white/45">{formatRemovedAt(record.removed_at)}</span>
                    </span>
                    <button
                      class={smallButton}
                      type="button"
                      disabled={restoring === record.dir_name}
                      onclick={() => void doRestore(record.dir_name)}
                    >
                      {restoring === record.dir_name
                        ? m["mirror.restoring"]()
                        : m["mirror.restore"]()}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </GlassPanel>
{/if}
