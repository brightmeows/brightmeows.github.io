<script lang="ts">
  import { page } from "$app/state";
  import { getLocale } from "$lib/paraglide/runtime";
  import "./layout.css";

  let { children } = $props();

  // 客户端动态设置 HTML lang 属性
  $effect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = getLocale();
    }
  });

  // 动态设置页面标题
  $effect(() => {
    if (typeof document !== "undefined" && page.data.title) {
      document.title = page.data.title as string;
    }
  });
</script>

<svelte:head>
  <link rel="icon" href="https://github.com/MiyakoMeow.png" />
</svelte:head>

{@render children()}
