<script lang="ts">
  import PageShell from "#lib/components/layout/PageShell.svelte";
  import GlassButton from "#lib/components/ui/GlassButton.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  // 错误页：404 与其它错误共用一张卡片，按状态码切换文案。
  // 根 layout 不渲染顶栏（顶栏在各页的 PageShell 里），这里补上站内出口，
  // 未知路径与加载失败都不再是无处可去的空白页。
  const notFound = $derived(page.status === 404);
  const heading = $derived(notFound ? m["error.not_found_title"]() : m["error.generic_title"]());
  const hint = $derived(
    notFound ? m["error.not_found_hint"]() : m["error.generic_hint"]({ status: page.status })
  );
  // 文案延迟求值：与顶栏菜单同一约定，模块求值期不触碰 m。
  const exits = [
    { href: resolve("/"), label: () => m["nav.home"]() },
    { href: resolve("/bms/table/mirror"), label: () => m["nav.mirror"]() },
    { href: resolve("/bms/table/search"), label: () => m["nav.search"]() },
  ];
</script>

<PageShell panes={[errorPane]} />

{#snippet errorPane()}
  <div class="py-12 text-center">
    <p class="m-0 text-[clamp(3rem,7vw,4.5rem)] leading-none font-extrabold text-white">
      {page.status}
    </p>
    <h1 class="page-title mt-4 mb-3">{heading}</h1>
    <p class="mx-auto mb-8 max-w-[30rem] text-white-70">{hint}</p>
    <div class="flex flex-wrap justify-center gap-3">
      {#each exits as exit (exit.href)}
        <GlassButton href={exit.href} size="md">{exit.label()}</GlassButton>
      {/each}
    </div>
  </div>
{/snippet}
