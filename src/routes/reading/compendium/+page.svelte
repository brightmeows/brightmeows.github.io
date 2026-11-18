<script lang="ts">
  import type { PageData } from "./$types";

  import PostListPage from "#lib/components/content/PostListPage.svelte";
  import { READING_BOOKS } from "#lib/constants/content.js";
  import { m } from "#lib/paraglide/messages.js";

  let { data }: { data: PageData } = $props();
</script>

<PostListPage
  heading={READING_BOOKS.compendium}
  posts={data.posts}
  intro={m["content.reading.compendium_intro"]()}
  meta={m["content.reading.chapter_count"]({ count: data.posts.length })}
/>
