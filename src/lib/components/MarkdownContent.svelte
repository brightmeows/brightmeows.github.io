<script lang="ts">
  import "katex/dist/katex.min.css";
  import { onDestroy, onMount } from "svelte";

  export let className = "";

  let container: HTMLDivElement | null = null;
  let observer: MutationObserver | null = null;
  let scheduled = false;

  function slugifyHeadingText(input: string): string {
    const normalized = input
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const slug = normalized
      .replace(/[^a-z0-9\u4e00-\u9fff _-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");

    return slug || "section";
  }

  function ensureHeadingAnchors(): void {
    if (!container) return;

    const headings = Array.from(container.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    const usedIds: Record<string, number> = {};

    for (const heading of headings) {
      const existingAnchor = heading.querySelector(":scope > a.heading-anchor");
      if (existingAnchor) continue;

      const rawText = (heading.textContent ?? "").trim();
      const baseId = heading.id?.trim() || slugifyHeadingText(rawText);

      const currentCount = usedIds[baseId] ?? 0;
      usedIds[baseId] = currentCount + 1;
      const id = heading.id?.trim()
        ? heading.id.trim()
        : currentCount === 0
          ? baseId
          : `${baseId}-${currentCount + 1}`;

      heading.id = id;

      const anchor = document.createElement("a");
      anchor.className =
        "heading-anchor absolute -left-7 top-[0.2em] inline-flex size-5 items-center justify-center rounded text-white/40 opacity-0 transition hover:text-white/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30";
      anchor.setAttribute("href", `#${id}`);
      anchor.setAttribute("aria-label", "跳转到此标题");
      anchor.innerHTML =
        '<svg viewBox="0 0 24 24" class="size-4" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 13a5 5 0 0 1 0-7.07l1.41-1.42a5 5 0 0 1 7.07 7.07L17.07 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 0 1 0 7.07l-1.41 1.42a5 5 0 0 1-7.07-7.07L6.93 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      heading.insertBefore(anchor, heading.firstChild);
    }
  }

  function scheduleEnsureHeadingAnchors(): void {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureHeadingAnchors();

      if (location.hash.length > 1) {
        const id = decodeURIComponent(location.hash.slice(1));
        const el = document.getElementById(id);
        el?.scrollIntoView({ block: "start" });
      }
    });
  }

  onMount(() => {
    scheduleEnsureHeadingAnchors();

    if (!container) return;

    observer = new MutationObserver(() => scheduleEnsureHeadingAnchors());
    observer.observe(container, { childList: true, subtree: true });
  });

  onDestroy(() => {
    observer?.disconnect();
    observer = null;
  });
</script>

<div
  bind:this={container}
  class={[
    "markdown-content pr-7 pl-7 leading-relaxed text-white/90",
    "[&_h1]:relative [&_h1]:mt-10 [&_h1]:mb-4 [&_h1]:scroll-mt-24 [&_h1]:text-[clamp(2rem,3vw,2.5rem)] [&_h1]:leading-tight [&_h1]:font-extrabold [&_h1]:text-white [&_h1]:drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
    "[&_h2]:relative [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:text-[clamp(1.5rem,2.4vw,1.9rem)] [&_h2]:leading-snug [&_h2]:font-bold [&_h2]:text-white [&_h2]:drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]",
    "[&_h3]:relative [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:scroll-mt-24 [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-white",
    "[&_h4]:relative [&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:scroll-mt-24 [&_h4]:text-xl [&_h4]:font-semibold [&_h4]:text-white",
    "[&_h5]:relative [&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:scroll-mt-24 [&_h5]:text-lg [&_h5]:font-semibold [&_h5]:text-white",
    "[&_h6]:relative [&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:scroll-mt-24 [&_h6]:text-base [&_h6]:font-semibold [&_h6]:text-white/90",
    "[&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-white/90",
    "[&_a]:text-sky-300 [&_a]:underline [&_a]:decoration-white/20 [&_a]:underline-offset-4 [&_a:hover]:text-sky-200",
    "[&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
    "[&_pre]:mb-4 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/30 [&_pre]:p-4",
    "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
    "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-sky-300/50 [&_blockquote]:pl-4 [&_blockquote]:text-white/80 [&_blockquote]:italic",
    "[&_ol]:mb-4 [&_ol]:pl-6 [&_ul]:mb-4 [&_ul]:pl-6",
    "[&_li]:mb-2 [&_li]:text-white/90",
    "[&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:bg-white/5",
    "[&_th]:border [&_th]:border-white/10 [&_th]:bg-sky-300/20 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-bold [&_th]:text-white",
    "[&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-3 [&_td]:text-left",
    "[&_.katex]:text-[1.1em]",
    "[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-4",
    "[&_.info]:my-4 [&_.info]:rounded [&_.info]:border-l-4 [&_.info]:border-sky-300 [&_.info]:bg-white/5 [&_.info]:p-4",
    "[&_.warning]:my-4 [&_.warning]:rounded [&_.warning]:border-l-4 [&_.warning]:border-orange-400 [&_.warning]:bg-white/5 [&_.warning]:p-4",
    "[&_.tip]:my-4 [&_.tip]:rounded [&_.tip]:border-l-4 [&_.tip]:border-emerald-400 [&_.tip]:bg-white/5 [&_.tip]:p-4",
    "[&_h1:hover_.heading-anchor]:opacity-100 [&_h2:hover_.heading-anchor]:opacity-100 [&_h3:hover_.heading-anchor]:opacity-100 [&_h4:hover_.heading-anchor]:opacity-100 [&_h5:hover_.heading-anchor]:opacity-100 [&_h6:hover_.heading-anchor]:opacity-100",
    className,
  ]
    .filter(Boolean)
    .join(" ")}
>
  <slot />
</div>
