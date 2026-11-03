<script lang="ts">
  import type { Post } from "#lib/types/post.js";

  interface Props {
    post: Post;
  }

  let { post }: Props = $props();
</script>

<a
  class="block rounded-glass-md border border-border-subtle bg-canvas p-6 text-text no-underline transition-[transform,background] duration-300 ease-out hover:-translate-y-0.5 hover:bg-surface-subtle"
  href={post.url}
>
  <div class="mb-1 flex flex-wrap items-baseline justify-between gap-3">
    <div class="accent-title">{post.title}</div>
    {#if post.date}
      <div class="text-[0.85rem] text-text-secondary">{post.date}</div>
    {/if}
  </div>
  <div class="text-[0.95rem] text-text-secondary">{post.firstSentence}</div>
</a>
