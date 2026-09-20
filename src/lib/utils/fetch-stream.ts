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

export async function fetchStream(
  url: string,
  signal?: AbortSignal,
  onProgress?: (progress: StreamProgress) => void
): Promise<{ response: Response; bytes: Uint8Array }> {
  const response = await fetch(url, { signal: signal ?? null, redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  if (!onProgress || !response.body) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    return {
      response: new Response(bytes, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
      bytes,
    };
  }

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress({ loaded, total });
    }
  }

  const combined = new Uint8Array(loaded);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }

  return {
    response: new Response(combined, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
    bytes: combined,
  };
}
