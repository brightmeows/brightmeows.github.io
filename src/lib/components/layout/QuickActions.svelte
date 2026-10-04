<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";

  function scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<div class="fixed right-4 bottom-4 z-1000 flex flex-col gap-3">
  <button
    class="group relative flex size-14 items-center justify-center rounded-full text-white transition-all active:scale-95"
    type="button"
    aria-label={m["common.back_to_top"]()}
    title={m["common.back_to_top"]()}
    onclick={scrollToTop}
  >
    <!-- 折射玻璃表面层：滤镜只作用于该层，图标保持清晰 -->
    <span
      class="lg-refract-circle glass-base absolute inset-0 rounded-full bg-glass-light transition-colors glass-shadow-md group-hover:bg-glass-hover"
      aria-hidden="true"
    ></span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      class="relative size-15"
      fill="currentColor"
    >
      <path d="M12 4l-7 7h4v9h6v-9h4L12 4z" />
    </svg>
  </button>
</div>
