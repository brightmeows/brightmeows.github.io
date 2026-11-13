<script lang="ts">
  import type { DisabledEntry } from "@brightmeows/mirror/user-layer";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import X from "@lucide/svelte/icons/x";

  import { btnGhost, inputInline } from "#lib/constants/ui-classes.js";
  import type { AdminOverview, TrashEntry } from "#lib/data/api/mirror-admin-api.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import type { MirrorOverviewState } from "#lib/types/bms-view.js";
  import { formatAbsolute, formatRelativeTime } from "#lib/utils/infra/date.js";

  interface Props {
    overviewState: MirrorOverviewState;
    error: string | null;
    overview: AdminOverview | null;
    busy: boolean;
    onretry: () => void;
    onreplaceadd: (from: string, to: string) => Promise<boolean>;
    onreplaceremove: (from: string) => Promise<boolean>;
    onenable: (entry: DisabledEntry) => Promise<boolean>;
    onrestore: (entry: TrashEntry) => Promise<boolean>;
  }

  let {
    overviewState,
    error,
    overview,
    busy,
    onretry,
    onreplaceadd,
    onreplaceremove,
    onenable,
    onrestore,
  }: Props = $props();

  let replaceFrom = $state("");
  let replaceTo = $state("");

  const sectionTitle = "mb-2 text-[1rem] font-semibold text-white";

  async function submitReplace(): Promise<void> {
    const ok = await onreplaceadd(replaceFrom.trim(), replaceTo.trim());
    if (ok) {
      replaceFrom = "";
      replaceTo = "";
    }
  }
</script>

<div>
  {#if overview === null && (overviewState === "idle" || overviewState === "loading")}
    <div class="text-[0.95rem] text-white-70">{m["common.loading_data"]()}</div>
  {:else if overview === null}
    <div class="flex flex-wrap items-center gap-3 text-[0.95rem] text-error">
      <span>{error ?? m["common.load_failed"]()}</span>
      <button class={btnGhost} type="button" onclick={onretry}>
        <RotateCcw class="size-4 shrink-0" aria-hidden="true" />
        {m["common.retry"]()}
      </button>
    </div>
  {:else}
    <div class="flex flex-col gap-5">
      <section>
        <h3 class={sectionTitle}>{m["admin.replace.heading"]()}</h3>
        <div class="flex flex-wrap items-center gap-2">
          <input
            class={inputInline}
            type="text"
            bind:value={replaceFrom}
            placeholder={m["admin.replace.from"]()}
            aria-label={m["admin.replace.from_aria"]()}
            disabled={busy}
          />
          <input
            class={inputInline}
            type="text"
            bind:value={replaceTo}
            placeholder={m["admin.replace.to"]()}
            aria-label={m["admin.replace.to_aria"]()}
            disabled={busy}
          />
          <button
            class={btnGhost}
            type="button"
            disabled={busy || replaceFrom.trim() === "" || replaceTo.trim() === ""}
            onclick={() => void submitReplace()}
          >
            <Plus class="size-4 shrink-0" aria-hidden="true" />
            {m["admin.replace.add"]()}
          </button>
        </div>
        {#if overview.replace.length > 0}
          <ul class="mt-2 flex flex-col gap-1 text-[0.85rem] text-white-70">
            {#each overview.replace as rule (rule.from)}
              <li class="flex flex-wrap items-center justify-between gap-2">
                <span>{m["admin.replace.item"]({ from: rule.from, to: rule.to })}</span>
                <button
                  class={btnGhost}
                  type="button"
                  disabled={busy}
                  onclick={() => void onreplaceremove(rule.from)}
                >
                  <X class="size-4 shrink-0" aria-hidden="true" />
                  {m["admin.replace.remove"]()}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section>
        <h3 class={sectionTitle}>{m["admin.disable.list"]()}</h3>
        {#if overview.disabled.length === 0}
          <div class="text-[0.85rem] text-white-50">{m["admin.misc.empty"]()}</div>
        {:else}
          <ul class="flex flex-col gap-1 text-[0.85rem] text-white-70">
            {#each overview.disabled as item (item.url)}
              <li class="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {item.dir_name ?? item.url}{#if item.note}<span class="ml-1 text-white-50"
                      >{m["admin.disable.note_wrap"]({ note: item.note })}</span
                    >{/if}
                </span>
                <button
                  class={btnGhost}
                  type="button"
                  disabled={busy}
                  onclick={() => void onenable(item)}
                >
                  <CircleCheck class="size-4 shrink-0" aria-hidden="true" />
                  {m["admin.disable.enable"]()}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section>
        <h3 class={sectionTitle}>{m["admin.trash.heading"]({ count: overview.trash.length })}</h3>
        {#if overview.trash.length === 0}
          <div class="text-[0.85rem] text-white-50">{m["admin.misc.empty"]()}</div>
        {:else}
          <ul class="flex flex-col gap-1 text-[0.85rem] text-white-70">
            {#each overview.trash as item (item.trash_prefix)}
              <li class="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {item.dir_name}<span
                    class="ml-2 text-white-50"
                    title={formatAbsolute(item.uploaded, getLocale())}
                    >{formatRelativeTime(item.uploaded, getLocale())}</span
                  >
                </span>
                <button
                  class={btnGhost}
                  type="button"
                  disabled={busy}
                  onclick={() => void onrestore(item)}
                >
                  <Undo2 class="size-4 shrink-0" aria-hidden="true" />
                  {m["admin.trash.restore"]()}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section>
        <h3 class={sectionTitle}>{m["admin.audit.heading"]({ count: overview.audit.length })}</h3>
        {#if overview.audit.length === 0}
          <div class="text-[0.85rem] text-white-50">{m["admin.misc.empty"]()}</div>
        {:else}
          <ul class="flex flex-col gap-1 text-[0.85rem] text-white-70">
            {#each overview.audit as entry}
              <li>
                <span class="text-white-50" title={formatAbsolute(entry.at, getLocale())}>
                  {formatRelativeTime(entry.at, getLocale())}
                </span>
                <span class="ml-2 text-white-90">{entry.actor}</span>
                <span class="ml-2 text-accent">{entry.action}</span>
                <span class="ml-2">{entry.dir_name ?? entry.url ?? ""}</span>
                {#if entry.detail}<span class="ml-2 text-white-50">{entry.detail}</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</div>
