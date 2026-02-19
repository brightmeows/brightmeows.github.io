<script lang="ts">
  import BreadcrumbNav from "$lib/components/BreadcrumbNav.svelte";
  import FloatingToc from "$lib/components/FloatingToc.svelte";
  import MarkdownContent from "$lib/components/MarkdownContent.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";
  import type { BlogPost } from "$lib/types/blog";

  export let data: {
    post: Partial<BlogPost>;
    component: import("svelte").Component;
    title: string;
  };
  const { post, component: Content } = data;

  const breadcrumbs = [
    { label: "主页", href: "/" },
    { label: "博客", href: "/blog" },
    { label: post.title ?? "文章" },
  ];
</script>

<StarryBackground />
<ProfileCard />
<BreadcrumbNav items={breadcrumbs} sessionKey="blog-post-nav" />
<FloatingToc />

<main class="m-0 mx-auto box-border w-full max-w-350 p-8">
  <article class="animate-fadeIn mt-8 rounded-[20px] border border-white/10 bg-white/10 p-8">
    <h1 class="page-title mb-4">{post.title}</h1>
    {#if post.date}
      <div class="mb-8 text-white/60">{post.date}</div>
    {/if}

    <MarkdownContent>
      <svelte:component this={Content} />
    </MarkdownContent>
  </article>
</main>
