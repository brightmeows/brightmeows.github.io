<script lang="ts">
  function scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<div class="fixed right-4 bottom-4 z-1000 flex flex-col gap-3">
  <button
    class="flex size-14 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-[0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-all hover:bg-white/25"
    type="button"
    aria-label="回到顶部"
    title="回到顶部"
    onclick={scrollToTop}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-15" fill="currentColor">
      <path d="M12 4l-7 7h4v9h6v-9h4L12 4z" />
    </svg>
  </button>
</div>
