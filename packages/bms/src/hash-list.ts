/**
 * 哈希清单导入的纯函数层：解析“md5 sha256”清单，在表内条目与段位谱面行
 * 上双向补哈希。匹配是双向的——目标行任一哈希命中清单行即算匹配，只补
 * 缺失的那只；已有值与清单不一致时保留原值并计入冲突，绝不覆盖。
 */

import type { CourseChartItem, CourseModel } from "./course.ts";

const MD5_RE = /^[0-9a-f]{32}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

/** 清单行：两端均为小写十六进制，解析保证两段齐备。 */
export interface HashListRow {
  md5: string;
  sha256: string;
}

export interface HashListParseResult {
  rows: HashListRow[];
  /** 没有提取出有效 md5/sha256 对的行数（空行与 # 注释行不计）。 */
  invalidLines: number;
}

/**
 * 解析清单文本：每行按空白、逗号或分号切分，32 位十六进制归 md5、64 位
 * 归 sha256（各取首个，大小写归一）；两段齐备才算有效行。
 */
export function parseHashList(text: string): HashListParseResult {
  const rows: HashListRow[] = [];
  let invalidLines = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    let md5 = "";
    let sha256 = "";
    for (const token of trimmed.split(/[\s,;]+/)) {
      if (md5 === "" && MD5_RE.test(token)) {
        md5 = token.toLowerCase();
      } else if (sha256 === "" && SHA256_RE.test(token)) {
        sha256 = token.toLowerCase();
      }
    }
    if (md5 !== "" && sha256 !== "") rows.push({ md5, sha256 });
    else invalidLines += 1;
  }
  return { rows, invalidLines };
}

export interface HashListApplyResult {
  /** 补写后的条目数组；未命中的条目原样保留（不改入参）。 */
  entries: Record<string, unknown>[];
  /** 补写后的段位模型；未命中的行原样保留（不改入参）。 */
  courseModel: CourseModel;
  /** 补写哈希的总次数。 */
  filled: number;
  /** 命中至少一条清单行的条目行数。 */
  entryRows: number;
  /** 命中至少一条清单行的段位谱面行数。 */
  courseRows: number;
  /** 清单值与已有值不一致而保留原值的次数。 */
  conflicts: number;
  /** 条目与段位行都未命中的清单行数。 */
  unmatched: number;
}

interface PairTexts {
  md5: string;
  sha256: string;
}

/** 一条清单行应用到一只哈希对的净效果（不改值，只算结果）。 */
interface PairFill extends PairTexts {
  filled: number;
  conflicts: number;
}

interface PairIndex {
  rows: readonly HashListRow[];
  byMd5: Map<string, number[]>;
  bySha256: Map<string, number[]>;
}

function pairTextsOf(record: Record<string, unknown>): PairTexts {
  const text = (value: unknown): string => (typeof value === "string" ? value : "");
  return { md5: text(record.md5), sha256: text(record.sha256) };
}

function buildPairIndex(rows: readonly HashListRow[]): PairIndex {
  const byMd5 = new Map<string, number[]>();
  const bySha256 = new Map<string, number[]>();
  for (const [index, row] of rows.entries()) {
    const md5List = byMd5.get(row.md5);
    if (md5List) md5List.push(index);
    else byMd5.set(row.md5, [index]);
    const sha256List = bySha256.get(row.sha256);
    if (sha256List) sha256List.push(index);
    else bySha256.set(row.sha256, [index]);
  }
  return { rows: [...rows], byMd5, bySha256 };
}

/** 目标行命中的清单行下标（任一哈希相等即命中，去重）。 */
function matchingRows(index: PairIndex, md5: string, sha256: string): number[] {
  const normalizedMd5 = md5.trim().toLowerCase();
  const normalizedSha256 = sha256.trim().toLowerCase();
  const matches = new Set<number>();
  if (normalizedMd5 !== "") {
    for (const i of index.byMd5.get(normalizedMd5) ?? []) matches.add(i);
  }
  if (normalizedSha256 !== "") {
    for (const i of index.bySha256.get(normalizedSha256) ?? []) matches.add(i);
  }
  return [...matches].sort((a, b) => a - b);
}

function fillPair(row: HashListRow, md5: string, sha256: string): PairFill {
  let nextMd5 = md5;
  let nextSha256 = sha256;
  let filled = 0;
  let conflicts = 0;
  const currentMd5 = md5.trim().toLowerCase();
  const currentSha256 = sha256.trim().toLowerCase();
  if (currentMd5 === "") {
    nextMd5 = row.md5;
    filled += 1;
  } else if (currentMd5 !== row.md5) {
    conflicts += 1;
  }
  if (currentSha256 === "") {
    nextSha256 = row.sha256;
    filled += 1;
  } else if (currentSha256 !== row.sha256) {
    conflicts += 1;
  }
  return { md5: nextMd5, sha256: nextSha256, filled, conflicts };
}

function applyRowsToEntries(
  entries: readonly Record<string, unknown>[],
  index: PairIndex,
  appliedRows: Set<number>
): { entries: Record<string, unknown>[]; matchedRows: number; filled: number; conflicts: number } {
  let matchedRows = 0;
  let filled = 0;
  let conflicts = 0;
  const next = [...entries];
  for (const [i, entry] of entries.entries()) {
    const texts = pairTextsOf(entry);
    const rows = matchingRows(index, texts.md5, texts.sha256);
    if (rows.length === 0) continue;
    matchedRows += 1;
    let md5 = texts.md5;
    let sha256 = texts.sha256;
    for (const rowIndex of rows) {
      appliedRows.add(rowIndex);
      const result = fillPair(index.rows[rowIndex]!, md5, sha256);
      md5 = result.md5;
      sha256 = result.sha256;
      filled += result.filled;
      conflicts += result.conflicts;
    }
    if (md5 !== texts.md5 || sha256 !== texts.sha256) {
      const copy = { ...entry };
      if (md5 !== texts.md5) copy.md5 = md5;
      if (sha256 !== texts.sha256) copy.sha256 = sha256;
      next[i] = copy;
    }
  }
  return { entries: next, matchedRows, filled, conflicts };
}

function applyRowsToCourse(
  model: CourseModel,
  index: PairIndex,
  appliedRows: Set<number>
): { courseModel: CourseModel; matchedRows: number; filled: number; conflicts: number } {
  let matchedRows = 0;
  let filled = 0;
  let conflicts = 0;
  const courseModel: CourseModel = {
    ...model,
    groups: model.groups.map((group) => ({
      courses: group.courses.map((course) => ({
        ...course,
        charts: course.charts.map((item): CourseChartItem => {
          const rows = matchingRows(index, item.md5, item.sha256);
          if (rows.length === 0) return item;
          matchedRows += 1;
          let md5 = item.md5;
          let sha256 = item.sha256;
          for (const rowIndex of rows) {
            appliedRows.add(rowIndex);
            const result = fillPair(index.rows[rowIndex]!, md5, sha256);
            md5 = result.md5;
            sha256 = result.sha256;
            filled += result.filled;
            conflicts += result.conflicts;
          }
          if (md5 === item.md5 && sha256 === item.sha256) return item;
          return { ...item, md5, sha256 };
        }),
      })),
    })),
  };
  return { courseModel, matchedRows, filled, conflicts };
}

/** 在条目与段位行上双向应用清单：只补缺失，冲突保留，报告各项计数。 */
export function applyHashList(
  entries: readonly Record<string, unknown>[],
  courseModel: CourseModel,
  rows: readonly HashListRow[]
): HashListApplyResult {
  const index = buildPairIndex(rows);
  const appliedRows = new Set<number>();
  const entryResult = applyRowsToEntries(entries, index, appliedRows);
  const courseResult = applyRowsToCourse(courseModel, index, appliedRows);
  return {
    entries: entryResult.entries,
    courseModel: courseResult.courseModel,
    filled: entryResult.filled + courseResult.filled,
    entryRows: entryResult.matchedRows,
    courseRows: courseResult.matchedRows,
    conflicts: entryResult.conflicts + courseResult.conflicts,
    unmatched: rows.length - appliedRows.size,
  };
}
