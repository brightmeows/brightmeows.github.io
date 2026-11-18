<script lang="ts">
  import type { PageData } from "./$types";

  import PostListPage from "#lib/components/content/PostListPage.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let { data }: { data: PageData } = $props();
</script>

<PostListPage
  heading={m["content.category.blog"]()}
  posts={data.posts}
  intro={m["content.blog.intro"]()}
  meta={m["content.post_count"]({ count: data.posts.length })}
/>
