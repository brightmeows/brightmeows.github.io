/**
 * 写入剪贴板，自动 fallback 到 textarea 方案
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // clipboard API unavailable
  }

  // Clipboard API 不可用时，fallback 到 execCommand("copy")
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    document.body.removeChild(textarea);
    return false;
  }
}

/**
 * 剪贴板操作反馈 composable（单值模式）。
 * 调用 copy() 后 copied 自动在 resetMs 毫秒后恢复为 false。
 */
export function clipboardFeedback(resetMs = 1500) {
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copy(text: string): Promise<boolean> {
    const ok = await writeToClipboard(text);
    if (ok) {
      if (timer) clearTimeout(timer);
      copied = true;
      timer = setTimeout(() => {
        copied = false;
        timer = null;
      }, resetMs);
    }
    return ok;
  }

  return {
    get copied() {
      return copied;
    },
    copy,
  };
}

/**
 * 剪贴板操作反馈 composable（多字段模式）。
 * 适用于同一组件有多个独立的复制按钮（如 MD5、SHA256）。
 * copy(field, text) 后 copiedField 设为 field 值，resetMs 毫秒后恢复为 null。
 */
export function clipboardFieldFeedback(resetMs = 1500) {
  let copiedField = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copy(field: string, text: string): Promise<boolean> {
    const ok = await writeToClipboard(text);
    if (ok) {
      if (timer) clearTimeout(timer);
      copiedField = field;
      timer = setTimeout(() => {
        copiedField = null;
        timer = null;
      }, resetMs);
    }
    return ok;
  }

  return {
    get copiedField() {
      return copiedField;
    },
    copy,
  };
}
