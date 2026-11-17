<script lang="ts">
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Layers from "@lucide/svelte/icons/layers";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import Library from "@lucide/svelte/icons/library";
  import NotebookPen from "@lucide/svelte/icons/notebook-pen";
  import Search from "@lucide/svelte/icons/search";
  import Table2 from "@lucide/svelte/icons/table-2";
  import User from "@lucide/svelte/icons/user";
  import type { Component } from "svelte";

  import PageHero from "#lib/components/layout/PageHero.svelte";
  import { bmsPersonalNav } from "#lib/constants/nav.js";
  import { SOCIAL_LINKS } from "#lib/constants/social.js";
  import { btnGhostMd } from "#lib/constants/ui-classes.js";
  import { m } from "#lib/paraglide/messages.js";
  import { resolve } from "$app/paths";

  interface GuideLink {
    href: string;
    icon: Component;
    label: () => string;
    external?: boolean;
  }

  interface GuideGroup {
    label: () => string;
    links: GuideLink[];
  }

  // 首页导览按顶栏分组：BMS 公共服务、BMS 个人表、博客/内容、外部，每类一行。
  const services: GuideLink[] = [
    { href: resolve("/bms"), icon: LayoutGrid, label: () => m["nav.overview"]() },
    { href: resolve("/bms/table"), icon: Table2, label: () => m["nav.table"]() },
    { href: resolve("/bms/table/mirror"), icon: Layers, label: () => m["nav.mirror"]() },
    { href: resolve("/bms/table/search"), icon: Search, label: () => m["nav.search"]() },
  ];

  const personal: GuideLink[] = bmsPersonalNav.children.map((item) => ({
    href: item.href,
    icon: User,
    label: item.label,
  }));

  const content: GuideLink[] = [
    { href: resolve("/blog"), icon: BookOpen, label: () => m["content.category.blog"]() },
    { href: resolve("/notes"), icon: NotebookPen, label: () => m["content.category.notes"]() },
    { href: resolve("/reading"), icon: Library, label: () => m["content.category.reading"]() },
  ];

  const external: GuideLink[] = SOCIAL_LINKS.map((item) => ({
    href: item.href,
    icon: item.icon,
    label: () => item.label,
    external: true,
  }));

  const groups: GuideGroup[] = [
    { label: () => m["nav.bms_services"](), links: services },
    { label: () => m["nav.bms_personal"](), links: personal },
    { label: () => m["home.guide.content"](), links: content },
    { label: () => m["home.guide.external"](), links: external },
  ];
</script>

<PageHero titleText={m["site.name"]()}>
  {#snippet title()}{m["site.name"]()}{/snippet}
  {#snippet promo()}
    <div class="flex flex-col items-center gap-5">
      <p class="m-0 text-center text-[1.05rem] leading-relaxed text-white-70">
        {m["home.intro"]()}
      </p>
      <div
        class="grid w-full max-w-[820px] grid-cols-1 items-center gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr]"
      >
        {#each groups as group (group.label())}
          <span
            class="text-center text-[0.9rem] font-medium text-white-50 sm:text-right sm:whitespace-nowrap"
          >
            {group.label()}
          </span>
          <div class="flex flex-wrap justify-center gap-3 sm:justify-start">
            {#each group.links as item (item.href)}
              <a
                class={btnGhostMd}
                href={item.href}
                target={item.external === true ? "_blank" : undefined}
                rel={item.external === true ? "noopener noreferrer" : undefined}
              >
                <item.icon class="size-4 shrink-0" aria-hidden="true" />
                {item.label()}
              </a>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {/snippet}
</PageHero>
