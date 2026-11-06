<script lang="ts">
  import { onMount } from "svelte";

  import { attachPressGlow } from "#lib/utils/ui/press-glow.js";

  // 全局按钮光效：宿主判定与监听都在 utils/ui/press-glow，光效本体在 layout.css
  onMount(() => attachPressGlow());
</script>
