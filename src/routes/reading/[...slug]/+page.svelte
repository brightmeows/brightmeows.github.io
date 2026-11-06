<script lang="ts">
  import type { PageData } from "./$types";

  import PostArticle from "#lib/components/content/PostArticle.svelte";

  let { data }: { data: PageData } = $props();
</script>

<PostArticle
  title={data.post.title}
  date={data.post.date}
  component={data.component}
  prev={data.prev}
  next={data.next}
  bookToc={data.bookToc}
/>
