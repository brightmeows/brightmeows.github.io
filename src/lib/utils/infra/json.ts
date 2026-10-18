/**
 * JSON 预览与“点击复制”共用的序列化：循环引用降级为 `[Circular]`、
 * bigint 转字符串，缩进默认 2 空格。预览弹层与按钮直拷消费同一实现，
 * 复制到的文本因此与预览显示始终一致。
 */
export function formatJsonPreview(input: unknown, space = 2): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      input,
      (_key, v): unknown => {
        if (typeof v === "bigint") return v.toString();
        if (typeof v === "object" && v !== null) {
          const obj = v as object;
          if (seen.has(obj)) return "[Circular]";
          seen.add(obj);
        }
        return v;
      },
      space
    );
  } catch {
    try {
      return String(input);
    } catch {
      return "[Unserializable]";
    }
  }
}
