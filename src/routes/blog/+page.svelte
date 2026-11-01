<script lang="ts">
  import type { PageData } from "./$types";

  import PostListPage from "#lib/components/content/PostListPage.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let { data }: { data: PageData } = $props();
</script>

<PostListPage heading={m["content.category.blog"]()} posts={data.posts} />
