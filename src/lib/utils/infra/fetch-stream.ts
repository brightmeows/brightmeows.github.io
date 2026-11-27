/**
 * 流式下载工具：带字节级进度的 fetch，返回完整的 Response 和原始字节。
 *
 * - 当 onProgress 或 response.body 不可用时，退化为普通 fetch（无进度）。
 * - onProgress 回调接收已下载字节数和总字节数（Content-Length 缺失时为 0）。
 * - 返回的对象中包含重新构造的 Response（合并所有 chunk）和原始 Uint8Array。
 */
export interface StreamProgress {
  loaded: number;
  /** 总字节数，0 表示 Content-Length 缺失 */
  total: number;
}

/** HTTP 非 2xx；保留状态码供调用方翻译文案。 */
export class FetchStreamError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ""}`);
    this.name = "FetchStreamError";
    this.status = status;
  }
}

export interface ReadResponseResult {
  bytes: Uint8Array;
  /** Content-Length 解析值，0 表示缺失或非法 */
  total: number;
}

/** 读取响应体并逐 chunk 回调；已构造的 Response 由调用方决定如何处理。 */
export async function readResponseBytes(
  response: Response,
  onProgress?: (progress: StreamProgress) => void
): Promise<ReadResponseResult> {
  const contentLength = response.headers.get("Content-Length");
  const parsedLength = contentLength === null ? 0 : Number.parseInt(contentLength, 10);
  const total = Number.isFinite(parsedLength) && parsedLength > 0 ? parsedLength : 0;

  if (!onProgress || !response.body) {
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    onProgress?.({ loaded: bytes.length, total });
    return { bytes, total };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    // done 蕴含 value 为 undefined，二者合一可同时消除 done 的恒真判定
    const { value } = await reader.read();
    if (!value) break;
    chunks.push(value);
    loaded += value.length;
    onProgress({ loaded, total });
  }

  const combined = new Uint8Array(loaded);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }

  return { bytes: combined, total };
}

/** 流式拉取：携带进度回调，返回响应与完整字节（无 body 或无回调时一次读全）。 */
export async function fetchStream(
  url: string,
  signal?: AbortSignal,
  onProgress?: (progress: StreamProgress) => void
): Promise<{ response: Response; bytes: Uint8Array; total: number }> {
  const response = await fetch(url, { signal: signal ?? null, redirect: "follow" });
  if (!response.ok) throw new FetchStreamError(response.status, response.statusText);

  const { bytes, total } = await readResponseBytes(response, onProgress);
  const body = new Uint8Array(bytes).buffer;
  return {
    response: new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
    bytes,
    total,
  };
}
