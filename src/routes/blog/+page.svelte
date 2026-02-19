<script lang="ts">
  import { resolve } from "$app/paths";
  import BreadcrumbNav from "$lib/components/BreadcrumbNav.svelte";
  import ProfileCard from "$lib/components/ProfileCard.svelte";
  import StarryBackground from "$lib/components/StarryBackground.svelte";
  import type { BlogPost } from "$lib/types/blog";

  export let data: { posts: BlogPost[] };
  const { posts } = data;

  const breadcrumbs = [{ label: "主页", href: "/" }, { label: "博客" }];
</script>

<StarryBackground />
<ProfileCard />
<BreadcrumbNav items={breadcrumbs} sessionKey="blog-nav" />

<main class="m-0 mx-auto box-border w-full max-w-350 p-8">
  <section class="animate-fadeIn mt-8 rounded-[20px] border border-white/10 bg-white/10 p-8">
    <h1 class="page-title mb-8 text-center">博客文章</h1>

    {#if posts.length === 0}
      <div class="text-center text-white/70">暂无文章</div>
    {:else}
      <div class="flex flex-col gap-4">
        {#each posts as post (post.slug)}
          <a
            class="block rounded-[14px] border border-white/10 bg-black/20 p-6 text-white no-underline transition hover:-translate-y-0.5 hover:bg-white/5"
            href={resolve(post.url, {})}
          >
            <div class="mb-1 flex justify-between">
              <div class="text-xl font-bold text-sky-300">{post.title}</div>
              {#if post.date}
                <div class="text-sm text-white/60">{post.date}</div>
              {/if}
            </div>
            <div class="text-white/80">{post.firstSentence}</div>
          </a>
        {/each}
      </div>
    {/if}
  </section>
</main>
