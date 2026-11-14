<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Plus from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import { onMount } from "svelte";

  import ToggleButton from "#lib/components/ui/ToggleButton.svelte";
  import { btnGhost, btnGhostXs, inputPanel } from "#lib/constants/ui-classes.js";
  import {
    fetchFetchStatus,
    fetchPreview,
    fetchRemoved,
    submitAdd,
    submitRestore,
    type PreviewResult,
    type RemovedRecord,
  } from "#lib/data/api/mirror-user-api.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { formatAbsolute, formatRelativeTime } from "#lib/utils/infra/date.js";
  import { errorMessageOf } from "#lib/utils/infra/error.js";

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
      previewError = errorMessageOf(error, m["mirror.preview_failed"]());
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
        text: errorMessageOf(error, m["mirror.submit_failed"]()),
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
        text: errorMessageOf(error, m["mirror.restore_failed"]()),
      };
    } finally {
      restoring = null;
    }
  }
</script>

{#if auth.status === "ready"}
  <div class="flex flex-col gap-3">
    <div class="text-[0.9rem] text-white-60">
      {m["shared.detail.promo_before"]()}
      <a class={btnGhostXs} href="/bms/table">
        <ArrowLeft class="size-4 shrink-0" aria-hidden="true" />
        {m["nav.table"]()}
      </a>
      {m["shared.detail.promo_after"]()}
    </div>
    {#if user === null}
      <div class="text-[0.95rem] text-white-75">
        {m["mirror.login_hint"]()}
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <!-- 配额只在此页消耗（添加/恢复/删除），展示随写操作实时刷新 -->
          <div class="text-[0.9rem] text-white-60">
            {m["mirror.remaining"]({ count: user.remaining })}
          </div>
          <ToggleButton
            expanded={showRemoved}
            label={m["mirror.removed_count"]({ count: removed.length })}
            onToggle={() => (showRemoved = !showRemoved)}
          />
        </div>

        <form
          class="flex flex-wrap items-center gap-2"
          onsubmit={(event) => {
            event.preventDefault();
            if (preview !== null && !submitting) void doAdd();
          }}
        >
          <input
            class="{inputPanel} min-w-60 flex-1"
            type="url"
            bind:value={url}
            placeholder={m["mirror.add_url_placeholder"]()}
            aria-label={m["mirror.add_url_aria"]()}
          />
          <button
            class={btnGhost}
            type="button"
            disabled={previewing || url.trim() === ""}
            onclick={() => void doPreview()}
          >
            <Search class="size-4 shrink-0" aria-hidden="true" />
            {previewing ? m["mirror.previewing"]() : m["mirror.preview"]()}
          </button>
          <button class={btnGhost} type="submit" disabled={submitting || preview === null}>
            <Plus class="size-4 shrink-0" aria-hidden="true" />
            {submitting ? m["mirror.submitting"]() : m["mirror.submit"]()}
          </button>
        </form>

        {#if previewError}
          <div class="text-[0.9rem] text-amber-300">{previewError}</div>
        {/if}
        {#if preview}
          <div class="text-[0.9rem] text-white-70">
            {m["mirror.preview_result"]()}
            <strong class="text-white">{preview.name || m["mirror.no_name"]()}</strong>
            {preview.symbol ? m["mirror.preview_symbol"]({ symbol: preview.symbol }) : ""}{m[
              "mirror.preview_hint"
            ]()}
          </div>
        {/if}
        {#if progress}
          <div class="text-[0.9rem] text-accent">{progress}</div>
        {/if}
        {#if notice}
          <div class="text-[0.9rem] {notice.kind === 'ok' ? 'text-success' : 'text-error'}">
            {notice.text}
          </div>
        {/if}

        {#if showRemoved}
          <div class="border-t border-white-10 pt-3">
            {#if removed.length === 0}
              <div class="text-[0.9rem] text-white-60">{m["mirror.no_removed"]()}</div>
            {:else}
              <ul class="flex flex-col gap-2">
                {#each removed as record (record.dir_name)}
                  <li
                    class="flex flex-wrap items-center justify-between gap-2 text-[0.9rem] text-white-75"
                  >
                    <span>
                      {record.dir_name}
                      <span
                        class="ml-2 text-white-50"
                        title={formatAbsolute(record.removed_at, getLocale())}
                      >
                        {formatRelativeTime(record.removed_at, getLocale())}
                      </span>
                    </span>
                    <button
                      class={btnGhost}
                      type="button"
                      disabled={restoring === record.dir_name}
                      onclick={() => void doRestore(record.dir_name)}
                    >
                      <Undo2 class="size-4 shrink-0" aria-hidden="true" />
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
  </div>
{/if}
