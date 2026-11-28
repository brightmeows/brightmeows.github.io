/**
 * 确定进度条的最小响应体字节数。
 *
 * 小于该值即使有 Content-Length 也走不确定态，避免表头等小文件闪一下。
 */
export const PROGRESS_DETERMINATE_MIN_BYTES = 256 * 1024;
