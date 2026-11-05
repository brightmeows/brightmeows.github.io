<script lang="ts">
  import { fly } from "svelte/transition";

  import GlassPanel from "#lib/components/ui/GlassPanel.svelte";
  import { popoverLayer } from "#lib/components/ui/popover-layer.js";
  import { topbarIcon, topbarMenuItem } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale, setLocale } from "#lib/paraglide/runtime.js";
  import type { TopbarPanel } from "#lib/types/ui.js";

  interface Props {
    panel: TopbarPanel;
  }

  let { panel }: Props = $props();

  // 三语自称固定(不随界面语言变化),顺序 ja → zh-cn → en。文案仍走
  // messages,保持用户可见文本单一来源;label 延迟求值,模块顶层不触碰 m
  // (与 nav.ts 同一约定)。
  const languages: { code: "en" | "zh-cn" | "ja"; label: () => string }[] = [
    { code: "ja", label: () => m["topbar.lang_ja"]() },
    { code: "zh-cn", label: () => m["topbar.lang_zh"]() },
    { code: "en", label: () => m["topbar.lang_en"]() },
  ];
</script>

<div class="relative">
  <button
    type="button"
    class={topbarIcon}
    title={m["topbar.language"]()}
    aria-label={m["topbar.language"]()}
    aria-expanded={panel.isOpen()}
    {...panel.hover}
    onclick={(event) => panel.onToggle(event)}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      class="size-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path
        d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9s1.4-6.4 3.9-9z"
      />
    </svg>
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
      <GlassPanel class="rounded-2xl p-2" padding="none" rounded="none">
        {#each languages as language (language.code)}
          {@const active = getLocale() === language.code}
          <button
            type="button"
            class="{topbarMenuItem} flex w-full items-center justify-between {active
              ? 'font-semibold text-white'
              : ''}"
            lang={language.code}
            aria-current={active ? "true" : undefined}
            onclick={() => {
              if (!active) setLocale(language.code);
              panel.close();
            }}
          >
            {language.label()}
          </button>
        {/each}
      </GlassPanel>
    </div>
  {/if}
</div>
