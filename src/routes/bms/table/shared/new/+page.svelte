<script lang="ts">
  import { validateSharedId, type SharedIdError } from "@brightmeows/mirror/shared";
  import { onMount } from "svelte";

  import { goto } from "$app/navigation";
  import PageShell from "$lib/components/layout/PageShell.svelte";
  import GlassPanel from "$lib/components/ui/GlassPanel.svelte";
  import LoadingProgress from "$lib/components/ui/LoadingProgress.svelte";
  import { apiBase, SITE_ORIGIN } from "$lib/constants/site";
  import { btnPrimary, inputPanel } from "$lib/constants/ui-classes";
  import { fetchSharedCheckId } from "$lib/data/api/shared-api";
  import { auth } from "$lib/data/store/auth-store.svelte";
  import { sharedNewSeed } from "$lib/data/store/shared-new.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { sharedIdPreview } from "$lib/utils/shared-table";

  /**
   * 新建前置屏：id 实时预览与异步查重（需登录），可顺带填 name/symbol 作
   * 编辑器种子；确认后进入编辑器，首次保存才真正创建（D1 占位先行）。
   */
  let id = $state("");
  let name = $state("");
  let symbol = $state("");
  let origin = $state("");
  let loginHref = $state("/api/auth/login");
  let checkState = $state<"idle" | "checking" | "available" | "taken" | "aliased" | "failed">(
    "idle"
  );
  let busy = $state(false);

  const idResult = $derived.by(() => {
    const raw = id.trim();
    if (raw === "") return null;
    return validateSharedId(raw);
  });
  const canonicalId = $derived(idResult?.ok === true ? idResult.id : "");
  const idError = $derived(idResult === null || idResult.ok ? null : idResult.error);

  // 动态 key 会被 i18n 覆盖检查当成死 key，这里用字面量分发
  function idErrorMessage(error: SharedIdError): string {
    switch (error) {
      case "empty":
        return m["shared.id_error_empty"]();
      case "too_long":
        return m["shared.id_error_too_long"]();
      case "charset":
        return m["shared.id_error_charset"]();
      case "reserved":
        return m["shared.id_error_reserved"]();
    }
  }

  const unavailable = $derived(auth.status === "unavailable");
  const loggedIn = $derived(auth.status === "ready" && auth.user !== null);
  const preview = $derived(sharedIdPreview(canonicalId, origin));

  // 地址栏 origin 只在客户端有意义；预览在 SSR 期先渲染站内相对路径
  onMount(() => {
    origin = window.location.origin;
    // 从编辑器“另存为共享表”跳来时预填名称与符号（草稿认领由编辑器侧承担）
    const seed = sharedNewSeed.peek();
    name = seed.name;
    symbol = seed.symbol;
    void auth.ensureLoaded();
    const returnTo = `${window.location.pathname}`;
    loginHref = `${apiBase()}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
  });

  // 输入停顿 500ms 后查重：登录前不发请求（登录引导由页面承担）
  $effect(() => {
    const candidate = canonicalId;
    if (candidate === "" || !loggedIn) {
      checkState = "idle";
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      checkState = "checking";
      fetchSharedCheckId(candidate)
        .then((result) => {
          if (cancelled) return;
          checkState = !result.available ? "taken" : result.wasAliased ? "aliased" : "available";
        })
        .catch(() => {
          if (!cancelled) checkState = "failed";
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  });

  async function submit(): Promise<void> {
    if (idResult === null || !idResult.ok || busy) return;
    if (checkState === "aliased") {
      const ok = window.confirm(m["shared.id_was_aliased_confirm"]({ id: idResult.id }));
      if (!ok) return;
    }
    busy = true;
    try {
      sharedNewSeed.set(name.trim(), symbol.trim());
      await goto(`${preview}`);
    } finally {
      busy = false;
    }
  }
</script>

<PageShell panes={[titlePane, contentPane]} />

{#snippet titlePane()}
  <h1 class="page-title text-center">{m["shared.new_title"]()}</h1>
  <p class="mt-2 text-center text-[1.1rem] text-white-70">{m["shared.new_subtitle"]()}</p>
{/snippet}

{#snippet contentPane()}
  <GlassPanel>
    {#if auth.status === "idle" || auth.status === "loading"}
      <LoadingProgress
        variant="indeterminate"
        message={m["shared.checking_auth"]()}
        title={m["shared.new_title"]()}
      />
    {:else if unavailable}
      <div class="text-[0.95rem] text-white-75">
        {m["mirror.api_unavailable_before"]()}
        <a
          class="link-accent"
          href={`${SITE_ORIGIN}/bms/table/shared/new/`}
          target="_blank"
          rel="noopener noreferrer">{m["mirror.api_unavailable_link"]()}</a
        >{m["mirror.api_unavailable_after"]()}
      </div>
    {:else if !loggedIn}
      <div class="flex flex-col items-center gap-4 py-4 text-center">
        <p class="text-[1rem] text-white-75">{m["shared.login_required"]()}</p>
        <a class={btnPrimary} href={loginHref}>{m["topbar.login"]()}</a>
      </div>
    {:else}
      <form
        class="flex flex-col gap-5"
        onsubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <label class="mb-1.5 block text-[0.95rem] text-white-80" for="shared-id">
            {m["shared.id_label"]()}
          </label>
          <input
            class={inputPanel}
            id="shared-id"
            type="text"
            bind:value={id}
            placeholder={m["shared.id_placeholder"]()}
            autocomplete="off"
          />
          <p class="mt-1.5 text-[0.85rem] text-white-50">{m["shared.id_hint"]()}</p>
          {#if idError !== null}
            <p class="mt-2 text-[0.9rem] text-red-300">{idErrorMessage(idError)}</p>
          {/if}
        </div>

        <div class="rounded-lg border border-white-15 bg-black-20 p-3">
          <div class="text-[0.85rem] text-white-50">{m["shared.id_preview_label"]()}</div>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <code class="font-mono text-[0.95rem] break-all text-[#64b5f6]">{preview}</code>
          </div>
          <div class="mt-2 text-[0.9rem]">
            {#if checkState === "checking"}
              <span class="text-white-60">{m["shared.id_checking"]()}</span>
            {:else if checkState === "available"}
              <span class="text-[#4caf50]">{m["shared.id_available"]()}</span>
            {:else if checkState === "aliased"}
              <span class="text-amber-300">{m["shared.id_was_aliased"]()}</span>
            {:else if checkState === "taken"}
              <span class="text-red-300">{m["shared.id_taken"]()}</span>
            {:else if checkState === "failed"}
              <span class="text-red-300">{m["shared.id_check_failed"]()}</span>
            {/if}
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-[0.95rem] text-white-80" for="shared-name">
              {m["shared.field_name"]()}
            </label>
            <input
              class={inputPanel}
              id="shared-name"
              type="text"
              bind:value={name}
              placeholder={m["shared.seed_name_placeholder"]()}
            />
          </div>
          <div>
            <label class="mb-1.5 block text-[0.95rem] text-white-80" for="shared-symbol">
              {m["shared.field_symbol"]()}
            </label>
            <input
              class={inputPanel}
              id="shared-symbol"
              type="text"
              bind:value={symbol}
              placeholder={m["shared.seed_symbol_placeholder"]()}
            />
          </div>
        </div>
        <p class="-mt-2 text-[0.85rem] text-white-50">{m["shared.seed_hint"]()}</p>

        <div class="text-center">
          <button class={btnPrimary} type="submit" disabled={idResult?.ok !== true || busy}>
            {m["shared.new_next"]()}
          </button>
        </div>
      </form>
    {/if}
  </GlassPanel>
{/snippet}
