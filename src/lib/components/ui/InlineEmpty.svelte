<script lang="ts">
  /** 面板内的单行空态；与区块卡内的字号、颜色保持一致。 */
  interface Props {
    text: string;
    class?: string;
  }

  let { text, class: className = "" }: Props = $props();
</script>

<p class="py-3 text-[0.9rem] text-white-50 {className}">{text}</p>
