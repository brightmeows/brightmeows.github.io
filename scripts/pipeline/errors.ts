/** 把未知异常整理为可读文本，并带上 fetch 的 cause（常见的是网络错误码）。 */

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.cause === undefined
      ? error.message
      : `${error.message}；cause=${describeCause(error.cause)}`;
  }
  return typeof error === "string" ? error : safeStringify(error);
}

function describeCause(cause: unknown): string {
  if (typeof cause === "object" && cause !== null && "code" in cause) {
    const code: unknown = cause.code;
    if (typeof code === "string" || typeof code === "number") {
      return String(code);
    }
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return typeof cause === "string" ? cause : safeStringify(cause);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "未知错误";
  } catch {
    return "未知错误";
  }
}
