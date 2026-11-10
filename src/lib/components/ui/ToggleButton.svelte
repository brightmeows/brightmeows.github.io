<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  import { btnToggle, btnToggleMd, btnToggleXs } from "#lib/constants/ui-classes.js";

  /**
   * 行内折叠开关：与操作按钮分离的切换形态（玻璃底、文字降一档色阶、
   * chevron 随展开旋转并经 aria-expanded 暴露状态）。展开后的内容渲染
   * 由调用方承担，本组件只管开关本身。
   */
  interface Props {
    /** 展开态。 */
    expanded: boolean;
    /** 按钮文字（三语消息由调用方求值）。 */
    label: string;
    /** 尺寸变体：缺省标准；xs 供表格行内，md 供大一号文字场景。 */
    size?: "xs" | "md" | undefined;
    disabled?: boolean;
    /** 切换回调。 */
    onToggle: () => void;
  }

  let { expanded, label, size = undefined, disabled = false, onToggle }: Props = $props();

  const token = $derived(size === "xs" ? btnToggleXs : size === "md" ? btnToggleMd : btnToggle);
  const iconSize = $derived(size === "xs" ? "size-3.5" : "size-4");
</script>

<button class={token} type="button" aria-expanded={expanded} {disabled} onclick={onToggle}>
  <span class="min-w-0 truncate">{label}</span>
  <ChevronDown
    class="{iconSize} shrink-0 transition-transform duration-200 {expanded ? 'rotate-180' : ''}"
    aria-hidden="true"
  />
</button>
