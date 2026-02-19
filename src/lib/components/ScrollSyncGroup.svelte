<script lang="ts">
  import { onDestroy } from "svelte";

  export let watchKeys: unknown = undefined;

  const containers: HTMLDivElement[] = [];

  let isSyncing = false;
  let rafId: number | null = null;

  function onWrapperScroll(e: Event): void {
    if (isSyncing) return;
    const target = e.currentTarget;
    if (!(target instanceof HTMLDivElement)) return;

    const left = target.scrollLeft;
    isSyncing = true;
    for (const el of containers) {
      if (el !== target) {
        el.scrollLeft = left;
      }
    }

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      isSyncing = false;
    });
  }

  function attach(el: HTMLDivElement): void {
    el.addEventListener("scroll", onWrapperScroll, { passive: true });
  }

  function detach(el: HTMLDivElement): void {
    el.removeEventListener("scroll", onWrapperScroll);
  }

  function refresh(): void {
    for (const el of containers) {
      detach(el);
      attach(el);
    }
  }

  function setRef(node: HTMLDivElement) {
    containers.push(node);
    attach(node);

    return {
      destroy() {
        detach(node);
        const index = containers.indexOf(node);
        if (index !== -1) {
          containers.splice(index, 1);
        }
      },
    };
  }

  $: if (watchKeys !== undefined) refresh();

  onDestroy(() => {
    for (const el of containers) {
      detach(el);
    }
    containers.length = 0;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  });
</script>

<slot {setRef} />
