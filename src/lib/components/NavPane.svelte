<script lang="ts">
  import GlassNavCard from "./ui/GlassNavCard.svelte";

  export interface NavChild {
    href: string;
    title: string;
    description: string;
  }

  interface Props {
    /** 自动生成的子页面导航 */
    children?: NavChild[];
    /** 手动追加的快捷导航 */
    shortcuts?: NavChild[];
  }

  let { children = [], shortcuts = [] }: Props = $props();
</script>

{#if children.length > 0 || shortcuts.length > 0}
  <div class="flex flex-col gap-6">
    {#if children.length > 0}
      <div>
        <h2 class="section-title text-center">子页面</h2>
        <div class="mt-4 flex flex-wrap items-stretch justify-center gap-4">
          {#each children as item (item.href)}
            <GlassNavCard href={item.href} title={item.title} description={item.description} />
          {/each}
        </div>
      </div>
    {/if}

    {#if shortcuts.length > 0}
      <div>
        <h2 class="section-title text-center">快捷入口</h2>
        <div class="mt-4 flex flex-wrap items-stretch justify-center gap-4">
          {#each shortcuts as item (item.href)}
            <GlassNavCard href={item.href} title={item.title} description={item.description} />
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
