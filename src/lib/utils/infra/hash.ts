/**
 * SHA-256 十六进制摘要，浏览器、Worker 与 Node 共用。
 *
 * 搜索索引 v2 的 manifest 带每文件 SHA-256，客户端下载后用本函数校验，
 * 兜住 rclone 并行上传时 manifest 与文件不配套的窗口。
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data instanceof Uint8Array ? data : new Uint8Array(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
