/**
 * bms-ir.org（非公式 LR2IR 互換成績站）谱面页 URL 的提取纯函数。
 * 谱面页形如 /new/song?songmd5=<md5>，songmd5 即谱面 md5；HTML 页对纯
 * HTTP 客户端有 Cloudflare 挑战，因此只做本地提取，不抓取远端内容。
 */

const BMS_IR_HOST_RE = /^https?:\/\/(?:www\.)?bms-ir\.org(?:\/|[?#]|$)/i;
const SONG_MD5_RE = /[?&]songmd5=([0-9a-f]{32})(?=$|[&#])/i;

/** 提取结果：成功带小写 md5，失败不区分原因（调用方提示统一文案）。 */
export type BmsIrSongMd5Result = { ok: true; md5: string } | { ok: false };

/** 从粘贴文本提取 bms-ir.org 谱面页的 songmd5；无效输入返回失败。 */
export function extractBmsIrSongMd5(raw: string): BmsIrSongMd5Result {
  const text = raw.trim();
  if (!BMS_IR_HOST_RE.test(text)) return { ok: false };
  const match = SONG_MD5_RE.exec(text);
  if (match === null) return { ok: false };
  return { ok: true, md5: match[1]!.toLowerCase() };
}
