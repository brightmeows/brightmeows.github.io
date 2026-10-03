import { applyEntryFields } from "@brightmeows/mirror/shared";

import { sortLevelValues } from "$lib/utils/bms-table";

/**
 * 难度表编辑器的纯函数层：条目筛选与批量操作、字段编辑提交、导出合并包、
 * 草稿键与冲突判定。组件状态与 IndexedDB 读写不在此处，保持可单测。
 */

/** 条目编辑表覆盖的核心字段（与 bms-table 规范的核心集对齐）。 */
export const CORE_ENTRY_FIELDS = [
  "level",
  "title",
  "artist",
  "md5",
  "sha256",
  "url",
  "url_diff",
  "name_diff",
  "url_pack",
  "name_pack",
  "comment",
  "org_md5",
  "mode",
] as const;

export type CoreEntryField = (typeof CORE_ENTRY_FIELDS)[number];

const CORE_FIELD_SET: ReadonlySet<string> = new Set(CORE_ENTRY_FIELDS);

/** 把 JSON 值渲染为可编辑的 JSON 文本（字符串带引号；undefined 与 null 渲染为空串）。 */
export function valueToText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return JSON.stringify(value) ?? "";
}

/** 头部核心字段的未知值转文本：字符串原样，空缺转空串，其余 String 化。 */
function headerFieldText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  // 头部核心字段实测均为字符串；对象值保持原组件内 str 的默认串化行为（行为冻结迁移）
  // eslint-disable-next-line typescript/no-base-to-string
  return String(value);
}

/** 头部可编辑核心子集（name、symbol、tag、mode）。 */
export interface EditorHeaderCore {
  name: string;
  symbol: string;
  tag: string;
  mode: string;
}

/**
 * 拆分头部：可编辑核心子集之外的字段原样保留在 extra（data_url、level_ref
 * 等；course 单独经 parseCourse 编辑，不属于 extra）。
 */
export function splitEditorHeader(header: Record<string, unknown>): {
  core: EditorHeaderCore;
  extra: Record<string, unknown>;
} {
  const extra = { ...header };
  for (const key of ["name", "symbol", "tag", "mode", "level_order", "course"]) delete extra[key];
  return {
    core: {
      name: headerFieldText(header.name),
      symbol: headerFieldText(header.symbol),
      tag: headerFieldText(header.tag),
      mode: headerFieldText(header.mode),
    },
    extra,
  };
}

/**
 * 从编辑态合成完整头部：核心字段 trim 后写回（tag 与 mode 空串即删除），
 * level_order 空列表删除，course 为 undefined 删除，extra 原样并入。
 */
export function buildEditorHeader(
  core: EditorHeaderCore,
  levels: readonly string[],
  course: unknown,
  extra: Record<string, unknown>
): Record<string, unknown> {
  const header = { ...extra };
  header.name = core.name.trim();
  header.symbol = core.symbol.trim();
  const trimmedTag = core.tag.trim();
  if (trimmedTag !== "") header.tag = trimmedTag;
  else delete header.tag;
  const trimmedMode = core.mode.trim();
  if (trimmedMode !== "") header.mode = trimmedMode;
  else delete header.mode;
  if (levels.length > 0) header.level_order = [...levels];
  else delete header.level_order;
  if (course !== undefined) header.course = course;
  else delete header.course;
  return header;
}

/** 把未知值安全转为展示文本：字符串原样，其余经 JSON 文本（对象不退化为 [object Object]）。 */
function textOf(value: unknown): string {
  return typeof value === "string" ? value : valueToText(value);
}

/** 条目编辑：核心字段的值文本（空串表示清除该键）。 */
export function coreFieldTexts(entry: Record<string, unknown>): Record<CoreEntryField, string> {
  const result = {} as Record<CoreEntryField, string>;
  for (const field of CORE_ENTRY_FIELDS) {
    result[field] = textOf(entry[field]);
  }
  return result;
}

/** 条目的非核心字段（自定义字段）编辑行；值为 JSON 文本。 */
export interface CustomFieldRow {
  key: string;
  valueText: string;
}

/** 条目的非核心字段按插入顺序列出；未定义的字段跳过。 */
export function customFieldRows(entry: Record<string, unknown>): CustomFieldRow[] {
  const rows: CustomFieldRow[] = [];
  for (const [key, value] of Object.entries(entry)) {
    if (CORE_FIELD_SET.has(key) || value === undefined) continue;
    rows.push({ key, valueText: valueToText(value) });
  }
  return rows;
}

/** 条目编辑提交失败的稳定原因码（展示文案由组件层映射 i18n）。 */
export type EntryCommitError =
  | "identity"
  | "custom_key_empty"
  | "custom_key_duplicate"
  | "custom_key_core"
  | "custom_value";

export interface EntryCommitInput {
  core: Record<CoreEntryField, string>;
  custom: CustomFieldRow[];
}

export type EntryCommitResult =
  | { ok: true; entry: Record<string, unknown> }
  | { ok: false; error: EntryCommitError; detail: string | undefined };

/**
 * 条目编辑提交：核心字段清空即删键；自定义字段逐行校验（键非空、不重复、
 * 不撞核心字段名，值为合法 JSON，空值表示删除该键）；未在编辑行里出现的
 * 原自定义字段删除。未知字段的类型经 JSON 文本往返，数字与对象不降级为字符串。
 */
export function commitEntryEdit(
  original: Record<string, unknown>,
  input: EntryCommitInput
): EntryCommitResult {
  const md5 = (input.core.md5 ?? "").trim();
  const sha256 = (input.core.sha256 ?? "").trim();
  if (md5 === "" && sha256 === "") {
    return { ok: false, error: "identity", detail: undefined };
  }

  const fields: Record<string, unknown> = {};
  for (const field of CORE_ENTRY_FIELDS) {
    const value = (input.core[field] ?? "").trim();
    fields[field] = value === "" ? undefined : value;
  }

  const seen = new Set<string>();
  for (const row of input.custom) {
    const key = row.key.trim();
    if (key === "") return { ok: false, error: "custom_key_empty", detail: undefined };
    if (CORE_FIELD_SET.has(key)) return { ok: false, error: "custom_key_core", detail: key };
    if (seen.has(key)) return { ok: false, error: "custom_key_duplicate", detail: key };
    seen.add(key);

    const text = row.valueText.trim();
    if (text === "") {
      fields[key] = undefined;
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "custom_value", detail: key };
    }
    fields[key] = parsed;
  }

  for (const key of Object.keys(original)) {
    if (CORE_FIELD_SET.has(key) || seen.has(key)) continue;
    fields[key] = undefined;
  }

  return { ok: true, entry: applyEntryFields(original, fields) };
}

/** 条目身份哈希（小写，用于判重与展示）。 */
export function entryHashes(entry: Record<string, unknown>): string[] {
  const result: string[] = [];
  for (const key of ["md5", "sha256"] as const) {
    const value = entry[key];
    if (typeof value === "string" && value.trim() !== "") result.push(value.trim().toLowerCase());
  }
  return result;
}

/** 哈希展示截断：超过 16 位截断加省略号（两条 shortHash 的哈希选择链刻意保留在组件侧）。 */
export function shortenHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 16)}…` : hash;
}

/** 勾选转移：单条切换（Set 进 Set 出，组件持 $state，此处只做纯转移）。 */
export function toggleSelection(selected: ReadonlySet<number>, index: number): Set<number> {
  const next = new Set(selected);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  return next;
}

/** 勾选转移：按索引集整体加（add）或移除（页全选切换、全选已筛共用）。 */
export function setIndices(
  selected: ReadonlySet<number>,
  indices: readonly number[],
  add: boolean
): Set<number> {
  const next = new Set(selected);
  for (const index of indices) {
    if (add) next.add(index);
    else next.delete(index);
  }
  return next;
}

/** 条目是否未指派等级。 */
export function isUnassigned(entry: Record<string, unknown>): boolean {
  const level = entry.level;
  if (level === undefined || level === null) return true;
  return typeof level === "string" && level.trim() === "";
}

export function countUnassigned(entries: readonly Record<string, unknown>[]): number {
  let count = 0;
  for (const entry of entries) {
    if (isUnassigned(entry)) count += 1;
  }
  return count;
}

/** 在表内查找与候选条目哈希相同的其他条目，返回其展示标签（无冲突返回 null）。 */
export function duplicateEntryLabel(
  entries: readonly Record<string, unknown>[],
  candidate: Record<string, unknown>,
  excludeIndex: number | null
): string | null {
  const hashes = new Set(entryHashes(candidate));
  if (hashes.size === 0) return null;
  for (const [index, entry] of entries.entries()) {
    if (index === excludeIndex) continue;
    for (const hash of entryHashes(entry)) {
      if (hashes.has(hash)) return entryLabel(entry);
    }
  }
  return null;
}

/** 行内展示标签：标题优先，缺失时回退哈希。 */
export function entryLabel(entry: Record<string, unknown>): string {
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  if (title !== "") return title;
  const hash = entryHashes(entry)[0];
  return hash ?? "";
}

/**
 * 等级筛选：全部、未指派、某个具体等级，或多选等级并集（目录复选框）。
 * 用判别联合而非字符串哨兵，避免与真实等级值（如名为 all 的等级）相撞。
 */
export type LevelFilter =
  | { kind: "all" }
  | { kind: "unassigned" }
  | { kind: "level"; level: string }
  | { kind: "levels"; levels: readonly string[]; unassigned: boolean };

/** 多选筛选构造：一个都不勾（含未指派）时回到“全部”。 */
export function levelFilterFromSelection(
  levels: Iterable<string>,
  unassigned: boolean
): LevelFilter {
  const selected = [...levels];
  if (selected.length === 0 && !unassigned) return { kind: "all" };
  return { kind: "levels", levels: selected, unassigned };
}

/** 筛选下拉的选项值编码：哨兵与等级值都经唯一前缀，杜绝相撞。 */
export const LEVEL_FILTER_ALL_OPTION = "__all__";
export const LEVEL_FILTER_UNASSIGNED_OPTION = "__unassigned__";
export const LEVEL_FILTER_LEVEL_PREFIX = "level:";

/** 把等级值编码为下拉选项值。 */
export function encodeLevelFilterOption(level: string): string {
  return `${LEVEL_FILTER_LEVEL_PREFIX}${level}`;
}

/** 解析下拉选项值；非编码值按等级值兜底。 */
export function parseLevelFilterOption(value: string): LevelFilter {
  if (value === LEVEL_FILTER_ALL_OPTION) return { kind: "all" };
  if (value === LEVEL_FILTER_UNASSIGNED_OPTION) return { kind: "unassigned" };
  if (value.startsWith(LEVEL_FILTER_LEVEL_PREFIX)) {
    return { kind: "level", level: value.slice(LEVEL_FILTER_LEVEL_PREFIX.length) };
  }
  return { kind: "level", level: value };
}

export interface EntryFilterState {
  level: LevelFilter;
  query: string;
}

/** 按等级与关键词（标题、艺术家、哈希、等级，NFKC 归一后包含匹配）筛选条目下标。 */
export function filterEntryIndices(
  entries: readonly Record<string, unknown>[],
  filter: EntryFilterState
): number[] {
  const needle = filter.query.trim().normalize("NFKC").toLowerCase();
  const result: number[] = [];
  for (const [index, entry] of entries.entries()) {
    if (filter.level.kind === "unassigned") {
      if (!isUnassigned(entry)) continue;
    } else if (filter.level.kind === "level") {
      if (textOf(entry.level) !== filter.level.level) continue;
    } else if (filter.level.kind === "levels") {
      const unassigned = isUnassigned(entry);
      if (unassigned) {
        if (!filter.level.unassigned) continue;
      } else if (!filter.level.levels.includes(textOf(entry.level))) {
        continue;
      }
    }
    if (needle !== "") {
      const haystack = [
        typeof entry.title === "string" ? entry.title : "",
        typeof entry.artist === "string" ? entry.artist : "",
        typeof entry.md5 === "string" ? entry.md5 : "",
        typeof entry.sha256 === "string" ? entry.sha256 : "",
        textOf(entry.level),
      ]
        .join("\n")
        .normalize("NFKC")
        .toLowerCase();
      if (!haystack.includes(needle)) continue;
    }
    result.push(index);
  }
  return result;
}

/** 条目等级分组：组的等级值，或未指派组的标记与全部下标。 */
export interface EntryLevelGroup {
  /** 分组等级值；未指派组为空串。 */
  level: string;
  /** 是否为未指派组（恒排在最后）。 */
  unassigned: boolean;
  /** 组内条目下标（保持传入 indices 的顺序）。 */
  indices: number[];
}

/**
 * 把（已筛选的）条目下标按等级分组：组次序由 level_order 与数字/字母回退决定，
 * 未指派组恒在最后；空组不输出。分组只影响呈现，不改变条目的源顺序。
 */
export function groupEntryIndices(
  entries: readonly Record<string, unknown>[],
  indices: readonly number[],
  levelOrder: readonly string[]
): EntryLevelGroup[] {
  const byLevel = new Map<string, number[]>();
  const unassignedIndices: number[] = [];
  for (const index of indices) {
    const entry = entries[index];
    if (entry === undefined) continue;
    if (isUnassigned(entry)) {
      unassignedIndices.push(index);
      continue;
    }
    const level = textOf(entry.level);
    const list = byLevel.get(level);
    if (list) list.push(index);
    else byLevel.set(level, [index]);
  }

  const groups: EntryLevelGroup[] = sortLevelValues([...byLevel.keys()], levelOrder).map(
    (level) => ({ level, unassigned: false, indices: byLevel.get(level) ?? [] })
  );
  if (unassignedIndices.length > 0) {
    groups.push({ level: "", unassigned: true, indices: unassignedIndices });
  }
  return groups;
}

/** 批量指派等级（空串表示清除等级）；返回新数组，不改动入参。 */
export function assignLevel(
  entries: readonly Record<string, unknown>[],
  indices: readonly number[],
  level: string
): Record<string, unknown>[] {
  const value = level.trim();
  const targets = new Set(indices);
  return entries.map((entry, index) => {
    if (!targets.has(index)) return entry;
    if (value === "") {
      const next = { ...entry };
      delete next.level;
      return next;
    }
    return { ...entry, level: value };
  });
}

/**
 * 按文件等级建议指派：未指派且能在 hints 中命中哈希（首个哈希）的条目写入建议等级。
 * 返回新数组与指派条数。
 */
export function assignHintLevels(
  entries: readonly Record<string, unknown>[],
  hints: Readonly<Record<string, string>>
): { entries: Record<string, unknown>[]; assigned: number } {
  let assigned = 0;
  const next = entries.map((entry) => {
    if (!isUnassigned(entry)) return entry;
    const hash = entryHashes(entry)[0];
    if (hash === undefined) return entry;
    const hint = hints[hash];
    if (hint === undefined || hint.trim() === "") return entry;
    assigned += 1;
    return { ...entry, level: hint.trim() };
  });
  return { entries: next, assigned };
}

/** 按下标删除条目；返回新数组，不改动入参。 */
export function removeIndices(
  entries: readonly Record<string, unknown>[],
  indices: readonly number[]
): Record<string, unknown>[] {
  const targets = new Set(indices);
  return entries.filter((_, index) => !targets.has(index));
}

/** 交换位置：把第 from 项插到第 to 项位置；越界或同位时原样返回副本。 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return [...items];
  next.splice(to, 0, item);
  return next;
}

/** 追加一个等级（去首尾空白、拒绝空值与重复）；返回新数组。 */
export function addLevel(levels: readonly string[], raw: string): string[] {
  const value = raw.trim();
  if (value === "" || levels.includes(value)) return [...levels];
  return [...levels, value];
}

/** 删除指定下标的等级；返回新数组。 */
export function removeLevelAt(levels: readonly string[], index: number): string[] {
  return levels.filter((_, i) => i !== index);
}

/** 头部 level_order 读取（只保留字符串与数字，数字转文本）。 */
export function levelOrderOf(header: Record<string, unknown>): string[] {
  const raw = header.level_order;
  if (!Array.isArray(raw)) return [];
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") result.push(item);
    else if (typeof item === "number") result.push(String(item));
  }
  return result;
}

/** 导出合并包：`{ header, data }`（导入侧经 parseCombinedPackage 识别）。 */
export function buildCombinedPackage(
  header: Record<string, unknown>,
  data: readonly Record<string, unknown>[]
): Record<string, unknown> {
  return { header, data };
}

/** 识别合并包结构；不是合并包时返回 null。 */
export function parseCombinedPackage(raw: unknown): { header: unknown; data: unknown } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (!("header" in record) || !("data" in record)) return null;
  return { header: record.header, data: record.data };
}

/** 草稿来源类型：镜像表、自托管表、共享表。 */
export type DraftSourceKind = "mirror" | "self" | "shared";

/** 编辑器导入面板的解析结果：header 与 data 可分别缺省（null 表示不改动）。 */
export interface TableImportResult {
  header: Record<string, unknown> | null;
  data: Record<string, unknown>[] | null;
  dataMode: "append" | "replace";
  source: "paste" | "file" | "fork";
}

/** 编辑器载荷（保存与另存共享用）。 */
export interface TableEditPayload {
  header: Record<string, unknown>;
  data: Record<string, unknown>[];
}

/** 本地 BMS/BMSON 拖拽导入的结果（按当前表与批内哈希去重后）。 */
export interface BmsDropResult {
  added: Record<string, unknown>[];
  /** 哈希（小写）→ 文件内等级建议。 */
  hints: Record<string, string>;
  skipped: number;
  failed: number;
  total: number;
}

/** 跨表选择导入的结果（按当前表哈希去重后）。 */
export interface EntryImportResult {
  added: Record<string, unknown>[];
  skipped: number;
  sourceLabel: string;
}

/** 草稿键：按来源与标识隔离（同源的镜像目录名与共享 id 不会互串）。 */
export function draftStorageKey(kind: DraftSourceKind, id: string): string {
  return `table-editor:${kind}:${id}`;
}

/** 单份草稿载荷（IndexedDB 结构克隆直存，无需序列化文本）。 */
export interface DraftPayload {
  header: Record<string, unknown>;
  data: Record<string, unknown>[];
  savedAt: string;
  /** 进入编辑时线上清单的 updated_at（共享表用于并发提示；其余来源为 undefined）。 */
  baselineUpdatedAt: string | undefined;
}

/**
 * 并发提示判定：草稿的线上基线早于当前线上时间时提示可能覆盖他人更新。
 * 两端都缺失时无从判断，返回 false（不提示）。
 */
export function shouldWarnOverwrite(
  baselineUpdatedAt: string | undefined,
  onlineUpdatedAt: string | undefined
): boolean {
  if (baselineUpdatedAt === undefined || onlineUpdatedAt === undefined) return false;
  return onlineUpdatedAt > baselineUpdatedAt;
}
