<script lang="ts">
  import { fly } from "svelte/transition";

  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import { popoverLayer } from "#lib/components/ui/popover-layer.js";
  import { topbarIcon, topbarMenuItem } from "#lib/constants/ui-classes.js";
  import { theme } from "#lib/data/store/theme-store.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { TopbarPanel } from "#lib/types/ui.js";
  import type { ThemePreference } from "#lib/utils/ui/theme.js";

  interface Props {
    panel: TopbarPanel;
  }

  let { panel }: Props = $props();

  // 三档偏好文案走 messages 保持单一来源;label 延迟求值,模块顶层不触碰 m。
  const options: { value: ThemePreference; label: () => string }[] = [
    { value: "light", label: () => m["topbar.theme.light"]() },
    { value: "dark", label: () => m["topbar.theme.dark"]() },
    { value: "system", label: () => m["topbar.theme.system"]() },
  ];
</script>

<div class="relative">
  <button
    type="button"
    class={topbarIcon}
    title={m["topbar.theme.label"]()}
    aria-label={m["topbar.theme.label"]()}
    aria-expanded={panel.isOpen()}
    {...panel.hover}
    onclick={(event) => panel.onToggle(event)}
  >
    {#if theme.preference === "light"}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        class="size-5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
    {:else if theme.preference === "dark"}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        class="size-5"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    {:else}
      <!-- 跟随系统:左半填充的半圆,与太阳/月亮同为圆形图标语言 -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        class="size-5"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" />
        <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
      </svg>
    {/if}
  </button>

  {#if panel.isOpen()}
    <div
      use:popoverLayer
      role="presentation"
      class="fixed w-40"
      style={panel.positionStyle()}
      {...panel.panelHover}
      in:fly={panel.in}
      out:fly={panel.out}
    >
      <GlassPanel class="rounded-glass-lg p-2" padding="none" rounded="none">
        {#each options as option (option.value)}
          {@const active = theme.preference === option.value}
          <button
            type="button"
            class="{topbarMenuItem} flex w-full items-center justify-between {active
              ? 'font-semibold text-white'
              : ''}"
            aria-current={active ? "true" : undefined}
            onclick={() => {
              theme.setPreference(option.value);
              panel.close();
            }}
          >
            {option.label()}
          </button>
        {/each}
      </GlassPanel>
    </div>
  {/if}
</div>
