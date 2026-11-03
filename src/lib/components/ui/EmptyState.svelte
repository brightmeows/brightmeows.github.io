<script lang="ts">
  interface Props {
    title: string;
    description: string;
    emoji?: string;
  }

  let { title, description, emoji = "📊" }: Props = $props();
</script>

<div class="empty-state">
  <div class="mb-4 text-[4rem]">{emoji}</div>
  <h3 class="mb-4 text-text">{title}</h3>
  <p class="text-text-secondary">{description}</p>
</div>
