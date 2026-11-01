<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    /** H1 的锚点 id（目录与页内跳转使用）。 */
    id?: string;
    /** 标题右侧的短元信息，宽屏贴内容列右缘。 */
    meta?: Snippet;
    /** 标题下方的副标题或说明。 */
    subtitle?: Snippet;
    /** 副标题下方的补充行（导入地址、外链等）。 */
    children?: Snippet;
    /** 操作按钮组，单独一行。 */
    actions?: Snippet;
  }

  let { title, id, meta, subtitle, children, actions }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
    <h1 {id} class="page-title m-0 text-left">{title}</h1>
    {#if meta}
      <div class="text-[1.05rem] text-white-70">
        {@render meta()}
      </div>
    {/if}
  </div>
  {#if subtitle}
    <div class="text-[1.05rem] text-white-70">
      {@render subtitle()}
    </div>
  {/if}
  {#if children}
    <div class="text-[1.05rem] text-white-70">
      {@render children()}
    </div>
  {/if}
  {#if actions}
    <div class="flex flex-wrap items-center gap-2 pt-1">
      {@render actions()}
    </div>
  {/if}
</div>
