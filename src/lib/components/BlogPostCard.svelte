<script lang="ts">
  import { resolve } from "$app/paths";
  import type { BlogPost } from "$lib/types/blog";

  interface Props {
    post: BlogPost;
  }

  let { post }: Props = $props();
</script>

<a
  class="block rounded-[14px] border border-white/10 bg-black/20 p-6 text-white no-underline transition-[transform,background] duration-300 ease-out hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.06)]"
  href={resolve(post.url, {})}
>
  <div class="mb-1 flex flex-wrap items-baseline justify-between gap-3">
    <div class="accent-title">{post.title}</div>
    {#if post.date}
      <div class="text-[0.85rem] text-white/60">{post.date}</div>
    {/if}
  </div>
  <div class="text-[0.95rem] text-white/80">{post.firstSentence}</div>
</a>
