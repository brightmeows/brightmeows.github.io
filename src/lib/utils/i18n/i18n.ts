import { m } from "$lib/paraglide/messages.js";

type MessageInputs = Record<string, string | number>;

const messageTable = m as unknown as Record<string, (inputs?: MessageInputs) => string>;

/**
 * 按消息 key 取当前语言文案（动态 key：Worker 错误码 `api.*`、存库的错误码）。
 * 未知 key 返回 null，调用方回落到透传文本（英文兜底或管道自由文本）。
 */
export function translateMessage(key: string, inputs?: MessageInputs): string | null {
  const resolve = messageTable[key];
  return resolve === undefined ? null : resolve(inputs);
}

/** 把响应里的 `params` 对象收窄成消息入参（非标量字段丢弃）。 */
export function messageInputs(value: unknown): MessageInputs | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const inputs: MessageInputs = {};
  for (const [name, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number") inputs[name] = item;
  }
  return Object.keys(inputs).length > 0 ? inputs : undefined;
}
