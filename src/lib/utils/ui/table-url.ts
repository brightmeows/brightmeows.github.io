/**
 * 难度表页 URL 的纯参数层：block 在 URL 里 1 起始，内部块下标 0 起始。
 * 只处理字符串与 URLSearchParams，不碰 location 或 history。
 */

/** 难度表页 URL 状态。 */
export interface TableUrlState {
  /** 内部块下标，0 起始。 */
  block: number;
  /** 搜索词；空串表示无搜索。 */
  q: string;
}

/** 从 URLSearchParams 文本解析 block 与 q；非法或缺失回退到第 1 块与空搜索。 */
export function readTableUrlState(search: string): TableUrlState {
  const params = new URLSearchParams(search);
  const rawBlock = params.get("block");
  const parsed = rawBlock !== null && /^\d+$/.test(rawBlock) ? Number(rawBlock) : Number.NaN;
  const block = Number.isInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
  const q = (params.get("q") ?? "").trim();
  return { block, q };
}

/**
 * 把 block 与 q 写回 URLSearchParams 文本。
 * block 为 0 或 null 时删除参数，q 为空或 null 时删除参数，其余参数原样保留。
 */
export function writeTableUrlState(
  search: string,
  next: { block?: number | null; q?: string | null }
): string {
  const params = new URLSearchParams(search);
  if (next.block !== undefined) {
    if (next.block === null || !Number.isInteger(next.block) || next.block <= 0) {
      params.delete("block");
    } else {
      params.set("block", String(next.block + 1));
    }
  }
  if (next.q !== undefined) {
    const q = next.q === null ? "" : next.q.trim();
    if (q === "") params.delete("q");
    else params.set("q", q);
  }
  return params.toString();
}

/** 把锚点 id 编码为 location.hash 文本；空 id 返回空串。 */
export function formatHashId(id: string): string {
  return id === "" ? "" : `#${encodeURIComponent(id)}`;
}

/** 从 location.hash 还原锚点 id；空 hash 或非法编码回退原文。 */
export function readHashId(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw === "") return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
