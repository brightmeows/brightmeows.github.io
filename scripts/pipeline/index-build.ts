/**
 * 索引构建：title、artist、md5、sha256 到表目录名的倒排索引。
 *
 * 与旧实现 output.rs 加 index.rs 的行为一致：只索引活跃表；哈希字段
 * 只接受符合长度且全为十六进制的值；超长哈希记为告警（按表折叠）。
 */

export interface LongHashWarning {
  count: number;
  sample: string;
}

export interface IndexBuildInput {
  dirName: string;
  dataRaw: string | null;
}

export interface IndexBuildResult {
  title: Map<string, Set<string>>;
  artist: Map<string, Set<string>>;
  md5: Map<string, Set<string>>;
  sha256: Map<string, Set<string>>;
  longHashWarnings: Map<string, LongHashWarning>;
  /** data.json 格式无法识别（既不是数组也不是带 charts/data/songs 的对象）的表。 */
  unrecognized: string[];
}

/**
 * 从 data.json 原文提取谱面条目：支持数组，或带 charts、data、songs 字段的对象。
 *
 * 与旧实现一样不做控制字符兜底（那一步在抓取阶段已完成）。
 */
export function extractChartItems(raw: string | null): unknown[] | null {
  if (raw === null) {
    return null;
  }
  let root: unknown;
  try {
    root = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (Array.isArray(root)) {
    return root as unknown[];
  }
  if (typeof root !== "object" || root === null) {
    return null;
  }
  const record = root as Record<string, unknown>;
  for (const key of ["charts", "data", "songs"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value as unknown[];
    }
  }
  return null;
}

function insertString(
  map: Map<string, Set<string>>,
  item: Record<string, unknown>,
  key: string,
  dirName: string
): void {
  const value = item[key];
  if (typeof value !== "string" || value === "") {
    return;
  }
  let bucket = map.get(value);
  if (bucket === undefined) {
    bucket = new Set<string>();
    map.set(value, bucket);
  }
  bucket.add(dirName);
}

function insertHash(
  map: Map<string, Set<string>>,
  warnings: Map<string, LongHashWarning>,
  item: Record<string, unknown>,
  key: "md5" | "sha256",
  expectedLength: number,
  dirName: string
): void {
  const raw = item[key];
  if (typeof raw !== "string" || raw === "") {
    return;
  }
  if (!/^[0-9a-fA-F]+$/u.test(raw)) {
    return;
  }
  if (raw.length === expectedLength) {
    let bucket = map.get(raw);
    if (bucket === undefined) {
      bucket = new Set<string>();
      map.set(raw, bucket);
    }
    bucket.add(dirName);
    return;
  }
  if (raw.length <= expectedLength) {
    return;
  }
  const sample = raw.length > 64 ? `${raw.slice(0, 64)}… (${raw.length} chars total)` : raw;
  const existing = warnings.get(dirName);
  if (existing === undefined) {
    warnings.set(dirName, { count: 1, sample });
  } else {
    existing.count += 1;
  }
}

/** 从活跃表的 data.json 原文构建四个倒排索引。 */
export function buildIndexes(entries: readonly IndexBuildInput[]): IndexBuildResult {
  const result: IndexBuildResult = {
    title: new Map<string, Set<string>>(),
    artist: new Map<string, Set<string>>(),
    md5: new Map<string, Set<string>>(),
    sha256: new Map<string, Set<string>>(),
    longHashWarnings: new Map<string, LongHashWarning>(),
    unrecognized: [],
  };

  for (const entry of entries) {
    const items = extractChartItems(entry.dataRaw);
    if (items === null) {
      if (entry.dataRaw !== null) {
        result.unrecognized.push(entry.dirName);
      }
      continue;
    }
    for (const item of items) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }
      const record = item as Record<string, unknown>;
      insertString(result.title, record, "title", entry.dirName);
      insertString(result.artist, record, "artist", entry.dirName);
      insertHash(result.md5, result.longHashWarnings, record, "md5", 32, entry.dirName);
      insertHash(result.sha256, result.longHashWarnings, record, "sha256", 64, entry.dirName);
    }
  }

  return result;
}

/** 把 `键 到 表名集合` 的映射整理为排序稳定的普通对象。 */
export function finalizeIndex(map: Map<string, Set<string>>): Record<string, string[]> {
  const keys = [...map.keys()].sort(compareByteOrder);
  const result: Record<string, string[]> = {};
  for (const key of keys) {
    const bucket = map.get(key);
    if (bucket === undefined) {
      continue;
    }
    result[key] = [...bucket].sort(compareByteOrder);
  }
  return result;
}

function compareByteOrder(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}
