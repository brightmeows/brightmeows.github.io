<script lang="ts">
  import type { PageData } from "./$types";

  import PostArticle from "#lib/components/content/PostArticle.svelte";
  import { m } from "#lib/paraglide/messages.js";

  let { data }: { data: PageData } = $props();
</script>

<PostArticle
  title={data.post.title}
  date={data.post.date}
  context={m["content.category.notes"]()}
  component={data.component}
/>
