<script lang="ts">
  import { page } from "$app/state";
  import { getLocale } from "$lib/paraglide/runtime";
  import "./layout.css";

  let { children } = $props();

  $effect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = getLocale();
    }
  });
</script>

<svelte:head>
  <title>{page.data.title || "白喵斯的小屋"}</title>
  <link rel="icon" href="https://github.com/MiyakoMeow.png" />
</svelte:head>

{@render children()}
