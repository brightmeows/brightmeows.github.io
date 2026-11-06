<script lang="ts">
  import type { PageData } from "./$types";

  import PostListPage from "#lib/components/content/PostListPage.svelte";
  import { READING_BOOKS } from "#lib/constants/content.js";

  let { data }: { data: PageData } = $props();
</script>

<PostListPage heading={READING_BOOKS.compendium} posts={data.posts} />
