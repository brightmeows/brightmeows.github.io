<script lang="ts">
  import GlassCard from "./GlassCard.svelte";

  interface Props {
    href: string;
    title: string;
    description: string;
  }

  let { href, title, description }: Props = $props();
</script>

<GlassCard {href} class="flex w-80 flex-col">
  <div class="accent-title mb-2">{title}</div>
  <div class="text-[0.95rem] text-white/80">{description}</div>
</GlassCard>
