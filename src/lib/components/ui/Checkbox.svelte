<script lang="ts">
  type Size = "sm" | "md";

  interface Props {
    /** 是否选中 */
    checked?: boolean;
    /** 半选状态（三态，仅视觉） */
    indeterminate?: boolean;
    /** 尺寸：sm(14px) / md(22px) */
    size?: Size;
    /** 是否禁用 */
    disabled?: boolean;
    /** 值变化回调，参数为选中状态 */
    onchange?: (checked: boolean) => void;
    /** 自定义类名 */
    class?: string;
  }

  let {
    checked = false,
    indeterminate = false,
    size = "md" as Size,
    disabled = false,
    onchange,
    class: className = "",
  }: Props = $props();

  let inputEl: HTMLInputElement | undefined = $state();

  // 同步 indeterminate DOM 属性到原生 checkbox（浏览器用该属性决定 :indeterminate 伪类匹配）
  $effect(() => {
    if (inputEl) {
      inputEl.indeterminate = indeterminate;
    }
  });

  function handleChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    onchange?.(target.checked);
  }
</script>

<input
  type="checkbox"
  bind:this={inputEl}
  {checked}
  {disabled}
  class="checkbox-custom {size === 'sm' ? 'checkbox-sm' : 'checkbox-md'} {className}"
  onchange={handleChange}
  aria-checked={indeterminate ? "mixed" : undefined}
/>

<style>
  /* === 基础样式: 移除原生外观，统一暗色玻璃态风格 === */
  .checkbox-custom {
    appearance: none;
    -webkit-appearance: none;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      opacity 0.2s ease;
    border-style: solid;
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    outline: none;
  }

  /* === 尺寸变体 === */
  .checkbox-sm {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border-width: 1.5px;
  }

  .checkbox-md {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border-width: 2px;
  }

  /* === 交互态 === */

  /* 悬停（未选中时） */
  .checkbox-custom:hover:not(:checked):not(:indeterminate):not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.3);
  }

  /* 选中态 */
  .checkbox-custom:checked {
    background: #64b5f6;
    border-color: #64b5f6;
  }

  /* 选中 + 悬停 */
  .checkbox-custom:checked:hover:not(:disabled) {
    background: #42a5f5;
    border-color: #42a5f5;
  }

  /* 半选态 */
  .checkbox-custom:indeterminate {
    background: #64b5f6;
    border-color: #64b5f6;
  }

  /* 半选 + 悬停 */
  .checkbox-custom:indeterminate:hover:not(:disabled) {
    background: #42a5f5;
    border-color: #42a5f5;
  }

  /* 聚焦环 */
  .checkbox-custom:focus-visible {
    box-shadow: 0 0 0 2px rgba(100, 181, 246, 0.5);
  }

  /* 禁用态 */
  .checkbox-custom:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* === 勾选标记（伪元素） === */
  .checkbox-custom::after {
    content: "";
    position: absolute;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  /* 勾号 */
  .checkbox-custom:checked::after {
    opacity: 1;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .checkbox-sm:checked::after {
    width: 3px;
    height: 7px;
    top: 2px;
    left: 4px;
    border-width: 0 1.5px 1.5px 0;
  }

  .checkbox-md:checked::after {
    width: 6px;
    height: 10px;
    top: 3px;
    left: 7px;
    border-width: 0 2px 2px 0;
  }

  /* 半选横线 */
  .checkbox-custom:indeterminate::after {
    opacity: 1;
    background: white;
    border-radius: 1px;
  }

  .checkbox-sm:indeterminate::after {
    width: 8px;
    height: 1.5px;
  }

  .checkbox-md:indeterminate::after {
    width: 12px;
    height: 2px;
  }
</style>
