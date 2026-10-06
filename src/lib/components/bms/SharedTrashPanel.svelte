<script lang="ts">
  import { onMount } from "svelte";

  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import { SITE_ORIGIN } from "#lib/constants/site.js";
  import { btnGhostXs } from "#lib/constants/ui-classes.js";
  import {
    fetchSharedRemoved,
    submitSharedRestore,
    type SharedRemovedEntry,
  } from "#lib/data/api/shared-api.js";
  import { auth } from "#lib/data/store/auth-store.svelte.js";
  import { m } from "#lib/paraglide/messages.js";

  /**
   * 共享表回收站：登录后展示自己的删除记录（admin 看全部），30 天内可恢复；
   * 超额（满 3 张）时服务端拒绝，错误经 code 翻译展示。
   */
  interface Props {
    /** 恢复成功后刷新列表。 */
    onchanged?: (() => void) | undefined;
  }

  let { onchanged }: Props = $props();

  const unavailable = $derived(auth.status === "unavailable");
  const user = $derived(auth.user);

  let open = $state(false);
  let entries = $state<SharedRemovedEntry[]>([]);
  let loaded = $state(false);
  let restoring = $state<string | null>(null);
  let notice = $state<{ kind: "ok" | "error"; text: string } | null>(null);

  $effect(() => {
    if (auth.status === "ready" && auth.user !== null && !loaded) {
      loaded = true;
      void load();
    }
  });

  async function load(): Promise<void> {
    try {
      entries = await fetchSharedRemoved();
    } catch {
      // 回收站读取失败不打断主流程
    }
  }

  /** 供父组件在删除后刷新回收站列表。 */
  export async function refresh(): Promise<void> {
    if (auth.user !== null) await load();
  }

  async function doRestore(id: string): Promise<void> {
    restoring = id;
    notice = null;
    try {
      await submitSharedRestore(id);
      notice = { kind: "ok", text: m["shared.restored"]({ id }) };
      await load();
      onchanged?.();
    } catch (error) {
      notice = {
        kind: "error",
        text: error instanceof Error ? error.message : m["shared.restore_failed"](),
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

  onMount(() => {
    void auth.ensureLoaded();
  });
</script>

{#if unavailable}
  <GlassPanel class="mt-4 text-[0.95rem] text-white-75">
    {m["mirror.api_unavailable_before"]()}
    <a
      class="link-accent"
      href={`${SITE_ORIGIN}/bms/table/shared/`}
      target="_blank"
      rel="noopener noreferrer">{m["mirror.api_unavailable_link"]()}</a
    >{m["mirror.api_unavailable_after"]()}
  </GlassPanel>
{:else if auth.status === "ready" && user !== null}
  <GlassPanel class="mt-4">
    <div class="flex flex-col gap-3">
      <div class="flex justify-end">
        <button class={btnGhostXs} type="button" onclick={() => (open = !open)}>
          {m["shared.trash_count"]({ count: entries.length })}
        </button>
      </div>
      {#if notice}
        <div class="text-[0.9rem] {notice.kind === 'ok' ? 'text-[#4caf50]' : 'text-red-300'}">
          {notice.text}
        </div>
      {/if}
      {#if open}
        <div class="rounded-lg border border-white-15 bg-black-20 p-3">
          {#if entries.length === 0}
            <div class="text-[0.9rem] text-white-60">{m["shared.no_trash"]()}</div>
          {:else}
            <ul class="flex flex-col gap-2">
              {#each entries as record (record.id)}
                <li
                  class="flex flex-wrap items-center justify-between gap-2 text-[0.9rem] text-white-75"
                >
                  <span>
                    {record.name}
                    <span class="ml-2 font-mono text-[0.8rem] text-white-45">{record.id}</span>
                    <span class="ml-2 text-white-45">{formatRemovedAt(record.removed_at)}</span>
                  </span>
                  <button
                    class={btnGhostXs}
                    type="button"
                    disabled={restoring === record.id}
                    onclick={() => void doRestore(record.id)}
                  >
                    {restoring === record.id
                      ? m["shared.restoring"]()
                      : m["shared.restore_button"]()}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  </GlassPanel>
{/if}
